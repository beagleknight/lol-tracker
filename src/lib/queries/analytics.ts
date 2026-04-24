/**
 * Shared analytics queries + server-side aggregation.
 * All heavy data processing happens here so the client receives only
 * pre-computed chart data and table stats (~25 KB instead of ~256 KB).
 */

import { eq, asc, and, gte, lte } from "drizzle-orm";

import type { RankSnapshot } from "@/db/schema";
import type { DateRange } from "@/lib/seasons";

import { db } from "@/db";
import { matches, coachingSessions, rankSnapshots, challenges } from "@/db/schema";
import { formatDate, DEFAULT_LOCALE } from "@/lib/format";
import { accountScope } from "@/lib/match-queries";
import { toCumulativeLP, getTierBoundaries, formatRank, formatTierDivision } from "@/lib/rank";
import { getLatestVersion } from "@/lib/riot-api";

// ─── Exported types for chart/table data ─────────────────────────────────────

export interface RankChartPoint {
  date: string;
  cumulativeLP: number;
  tier: string;
  division: string;
  lp: number;
  wins: number;
  losses: number;
  timestamp: number;
}

export interface LPChartMeta {
  yMin: number;
  yMax: number;
  tierBoundaries: Array<{ lp: number; label: string }>;
  events: Array<{
    index: number;
    type: "promotion" | "demotion";
    from: string;
    to: string;
  }>;
  netChange: number;
  peakIndex: number;
  peakRank: string;
  milestones: Array<{ index: number; tier: string }>;
}

export interface WinRatePoint {
  index: number;
  date: string;
  winRate: number;
}

export interface CoachingBands {
  sessionIndices: Array<{ index: number; coachName: string; status: string }>;
  bands: Array<{ x1: number; x2: number; label: string; isOngoing: boolean }>;
}

export interface MatchupStat {
  name: string;
  wins: number;
  losses: number;
  games: number;
  winRate: number;
}

export interface RuneStat {
  name: string;
  wins: number;
  losses: number;
  games: number;
  winRate: number;
}

export interface ChampionStat {
  name: string;
  wins: number;
  losses: number;
  games: number;
  winRate: number;
  kills: number;
  deaths: number;
  assists: number;
  avgKDA: string;
}

// ─── LTTB downsampling ───────────────────────────────────────────────────────

/**
 * Largest-Triangle-Three-Buckets downsampling.
 * Reduces an array to `threshold` points while preserving visual shape.
 * `getValue` extracts the Y value from each item; X is the array index.
 * `preserveIndices` are always kept (e.g. peak, events).
 */
function lttbDownsample<T>(
  data: T[],
  threshold: number,
  getValue: (item: T) => number,
  preserveIndices?: Set<number>,
): T[] {
  if (data.length <= threshold) return data;

  // Collect indices that must be preserved
  const mustKeep = new Set<number>([0, data.length - 1]);
  if (preserveIndices) {
    for (const idx of preserveIndices) mustKeep.add(idx);
  }

  // Standard LTTB with forced preservation
  const sampled: T[] = [data[0]];
  const sampledIndices = new Set<number>([0]);

  const bucketSize = (data.length - 2) / (threshold - 2);

  let prevIndex = 0;

  for (let i = 1; i < threshold - 1; i++) {
    const bucketStart = Math.floor((i - 1) * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor(i * bucketSize) + 1, data.length - 1);

    // Next bucket average (for triangle area calculation)
    const nextBucketStart = Math.min(Math.floor(i * bucketSize) + 1, data.length - 1);
    const nextBucketEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, data.length - 1);
    let avgX = 0;
    let avgY = 0;
    const nextBucketLen = nextBucketEnd - nextBucketStart + 1;
    for (let j = nextBucketStart; j <= nextBucketEnd; j++) {
      avgX += j;
      avgY += getValue(data[j]);
    }
    avgX /= nextBucketLen;
    avgY /= nextBucketLen;

    // Check if any must-keep index falls in this bucket
    let forcedIdx = -1;
    for (let j = bucketStart; j < bucketEnd; j++) {
      if (mustKeep.has(j) && !sampledIndices.has(j)) {
        forcedIdx = j;
        break;
      }
    }

    if (forcedIdx >= 0) {
      sampled.push(data[forcedIdx]);
      sampledIndices.add(forcedIdx);
      prevIndex = forcedIdx;
    } else {
      // Pick point with largest triangle area
      let maxArea = -1;
      let bestIdx = bucketStart;
      const prevY = getValue(data[prevIndex]);

      for (let j = bucketStart; j < bucketEnd; j++) {
        const area = Math.abs(
          (prevIndex - avgX) * (getValue(data[j]) - prevY) - (prevIndex - j) * (avgY - prevY),
        );
        if (area > maxArea) {
          maxArea = area;
          bestIdx = j;
        }
      }
      sampled.push(data[bestIdx]);
      sampledIndices.add(bestIdx);
      prevIndex = bestIdx;
    }
  }

  // Add any remaining must-keep indices that weren't captured
  const remaining: Array<{ idx: number; item: T }> = [];
  for (const idx of mustKeep) {
    if (!sampledIndices.has(idx)) {
      remaining.push({ idx, item: data[idx] });
    }
  }

  sampled.push(data[data.length - 1]);
  sampledIndices.add(data.length - 1);

  // Merge remaining must-keep points and re-sort by original index
  if (remaining.length > 0) {
    // Build index→item map for sorting
    const all: Array<{ idx: number; item: T }> = [];
    // We need original indices for sampled items too — reconstruct from data
    const finalSet = new Set<number>(sampledIndices);
    for (const r of remaining) finalSet.add(r.idx);

    for (const idx of finalSet) {
      all.push({ idx, item: data[idx] });
    }
    all.sort((a, b) => a.idx - b.idx);
    return all.map((a) => a.item);
  }

  return sampled;
}

// ─── Aggregation functions (run server-side) ─────────────────────────────────

interface RawMatch {
  gameDate: Date;
  result: string;
  championName: string;
  matchupChampionName: string | null;
  runeKeystoneName: string | null;
  kills: number;
  deaths: number;
  assists: number;
}

interface RawSession {
  id: number;
  coachName: string;
  date: Date;
  status: "scheduled" | "completed";
}

const MAX_CHART_POINTS = 50;

function prepareRankChartData(snapshots: RankSnapshot[], locale: string): RankChartPoint[] {
  const data: RankChartPoint[] = [];

  for (const s of snapshots) {
    const clp = toCumulativeLP(s.tier, s.division, s.lp);
    if (clp === null) continue;

    const dateStr = formatDate(s.capturedAt, locale, "short-compact");
    const tierName = s.tier ? s.tier.charAt(0) + s.tier.slice(1).toLowerCase() : "";

    data.push({
      date: dateStr,
      cumulativeLP: clp,
      tier: tierName,
      division: s.division || "",
      lp: s.lp || 0,
      wins: s.wins || 0,
      losses: s.losses || 0,
      timestamp: s.capturedAt.getTime(),
    });
  }

  return data;
}

function computeLPChartMeta(rankChartData: RankChartPoint[]): LPChartMeta | null {
  if (rankChartData.length < 2) return null;

  const allLP = rankChartData.map((d) => d.cumulativeLP);
  const minLP = Math.min(...allLP);
  const maxLP = Math.max(...allLP);
  const padding = Math.max((maxLP - minLP) * 0.1, 20);
  const yMin = Math.max(0, Math.floor((minLP - padding) / 100) * 100);
  const yMax = Math.ceil((maxLP + padding) / 100) * 100;

  const tierBoundaries = getTierBoundaries(yMin, yMax);

  // Detect tier changes
  const events: LPChartMeta["events"] = [];
  for (let i = 1; i < rankChartData.length; i++) {
    const prev = rankChartData[i - 1];
    const curr = rankChartData[i];
    if (prev.tier !== curr.tier) {
      events.push({
        index: i,
        type: curr.cumulativeLP > prev.cumulativeLP ? "promotion" : "demotion",
        from: formatTierDivision(prev.tier, prev.division),
        to: formatTierDivision(curr.tier, curr.division),
      });
    }
  }

  // Net LP change
  const first = rankChartData[0];
  const last = rankChartData[rankChartData.length - 1];
  const netChange = last.cumulativeLP - first.cumulativeLP;

  // Peak rank
  let peakIndex = 0;
  let peakLP = rankChartData[0].cumulativeLP;
  for (let i = 1; i < rankChartData.length; i++) {
    if (rankChartData[i].cumulativeLP > peakLP) {
      peakLP = rankChartData[i].cumulativeLP;
      peakIndex = i;
    }
  }
  const peakRank = formatRank(peakLP);

  // First-time-in-tier milestones
  const seenTiers = new Set<string>();
  const milestones: Array<{ index: number; tier: string }> = [];
  for (let i = 0; i < rankChartData.length; i++) {
    const tier = rankChartData[i].tier;
    if (tier && !seenTiers.has(tier)) {
      seenTiers.add(tier);
      if (i > 0) milestones.push({ index: i, tier });
    }
  }

  return { yMin, yMax, tierBoundaries, events, netChange, peakIndex, peakRank, milestones };
}

function computeRollingWinRate(
  rawMatches: RawMatch[],
  locale: string,
  window = 20,
): WinRatePoint[] {
  const meaningful = rawMatches.filter((m) => m.result !== "Remake");
  const data: WinRatePoint[] = [];
  for (let i = 0; i < meaningful.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = meaningful.slice(start, i + 1);
    const wins = slice.filter((m) => m.result === "Victory").length;
    const wr = Math.round((wins / slice.length) * 100);
    const dateStr = formatDate(meaningful[i].gameDate, locale, "short-compact");
    data.push({ index: i + 1, date: dateStr, winRate: wr });
  }
  return data;
}

function computeCoachingBands(
  rawMatches: RawMatch[],
  sessions: RawSession[],
  wrLength: number,
): CoachingBands {
  const meaningful = rawMatches.filter((m) => m.result !== "Remake");
  const sessionIndices = sessions.map((s) => {
    const sessionTime = s.date.getTime();
    let closestIdx = 0;
    let closestDiff = Infinity;
    for (let i = 0; i < meaningful.length; i++) {
      const diff = Math.abs(meaningful[i].gameDate.getTime() - sessionTime);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIdx = i;
      }
    }
    return { index: closestIdx + 1, coachName: s.coachName, status: s.status };
  });

  const bands: CoachingBands["bands"] = [];
  for (let i = 0; i < sessionIndices.length - 1; i++) {
    const from = sessionIndices[i];
    const to = sessionIndices[i + 1];
    bands.push({
      x1: from.index,
      x2: to.index,
      label: from.coachName,
      isOngoing: false,
    });
  }
  if (sessionIndices.length > 0) {
    const last = sessionIndices[sessionIndices.length - 1];
    if (last.index < wrLength) {
      bands.push({
        x1: last.index,
        x2: wrLength,
        label: last.coachName,
        isOngoing: last.status === "scheduled",
      });
    }
  }
  return { sessionIndices, bands };
}

function computeMatchupStats(rawMatches: RawMatch[]): MatchupStat[] {
  const stats = new Map<string, { wins: number; losses: number; games: number }>();
  for (const m of rawMatches) {
    if (m.result === "Remake") continue;
    const name = m.matchupChampionName || "Unknown";
    const existing = stats.get(name) || { wins: 0, losses: 0, games: 0 };
    existing.games++;
    if (m.result === "Victory") existing.wins++;
    else existing.losses++;
    stats.set(name, existing);
  }
  return Array.from(stats.entries())
    .map(([name, s]) => ({
      name,
      ...s,
      winRate: Math.round((s.wins / s.games) * 100),
    }))
    .sort((a, b) => b.games - a.games);
}

function computeRuneStats(rawMatches: RawMatch[]): RuneStat[] {
  const stats = new Map<string, { wins: number; losses: number; games: number }>();
  for (const m of rawMatches) {
    if (m.result === "Remake") continue;
    const name = m.runeKeystoneName || "Unknown";
    const existing = stats.get(name) || { wins: 0, losses: 0, games: 0 };
    existing.games++;
    if (m.result === "Victory") existing.wins++;
    else existing.losses++;
    stats.set(name, existing);
  }
  return Array.from(stats.entries())
    .map(([name, s]) => ({
      name,
      ...s,
      winRate: Math.round((s.wins / s.games) * 100),
    }))
    .sort((a, b) => b.games - a.games);
}

function computeChampionStats(rawMatches: RawMatch[]): ChampionStat[] {
  const stats = new Map<
    string,
    { wins: number; losses: number; games: number; kills: number; deaths: number; assists: number }
  >();
  for (const m of rawMatches) {
    if (m.result === "Remake") continue;
    const existing = stats.get(m.championName) || {
      wins: 0,
      losses: 0,
      games: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
    };
    existing.games++;
    if (m.result === "Victory") existing.wins++;
    else existing.losses++;
    existing.kills += m.kills;
    existing.deaths += m.deaths;
    existing.assists += m.assists;
    stats.set(m.championName, existing);
  }
  return Array.from(stats.entries())
    .map(([name, s]) => ({
      name,
      ...s,
      winRate: Math.round((s.wins / s.games) * 100),
      avgKDA: s.deaths === 0 ? "Perfect" : ((s.kills + s.assists) / s.deaths).toFixed(1),
    }))
    .sort((a, b) => b.games - a.games);
}

// ─── Main query + aggregation ────────────────────────────────────────────────

export interface AnalyticsData {
  rankChartData: RankChartPoint[];
  lpChartMeta: LPChartMeta | null;
  rollingWR: WinRatePoint[];
  coachingBands: CoachingBands;
  topMatchups: MatchupStat[];
  runeStats: RuneStat[];
  championStats: ChampionStat[];
  meaningfulCount: number;
  totalCount: number;
  ddragonVersion: string;
  activeGoal: { targetTier: string; targetDivision: string | null } | null;
  goalTargetLP: number | null;
  goalTargetLabel: string;
}

export async function getAnalyticsData(
  userId: string,
  riotAccountId: string | null,
  dateRange?: DateRange | null,
): Promise<AnalyticsData> {
  const dateConditions = dateRange
    ? [
        gte(matches.gameDate, dateRange.start),
        ...(dateRange.end ? [lte(matches.gameDate, dateRange.end)] : []),
      ]
    : [];

  const [allMatches, sessions, ranks, ddragonVersion, activeGoal] = await Promise.all([
    db.query.matches.findMany({
      where: and(
        eq(matches.userId, userId),
        accountScope(matches.riotAccountId, riotAccountId),
        ...dateConditions,
      ),
      orderBy: asc(matches.gameDate),
      columns: {
        gameDate: true,
        result: true,
        championName: true,
        matchupChampionName: true,
        runeKeystoneName: true,
        kills: true,
        deaths: true,
        assists: true,
      },
    }),
    db.query.coachingSessions.findMany({
      where: eq(coachingSessions.userId, userId),
      orderBy: asc(coachingSessions.date),
      columns: { id: true, coachName: true, date: true, status: true },
    }),
    db.query.rankSnapshots.findMany({
      where: and(
        eq(rankSnapshots.userId, userId),
        accountScope(rankSnapshots.riotAccountId, riotAccountId),
      ),
      orderBy: asc(rankSnapshots.capturedAt),
    }),
    getLatestVersion(),
    db.query.challenges.findFirst({
      where: and(
        eq(challenges.userId, userId),
        accountScope(challenges.riotAccountId, riotAccountId),
        eq(challenges.status, "active"),
        eq(challenges.type, "by-date"),
      ),
      columns: { targetTier: true, targetDivision: true },
    }),
  ]);

  const goal = activeGoal
    ? { targetTier: activeGoal.targetTier!, targetDivision: activeGoal.targetDivision }
    : null;

  // Use default locale for server-side formatting (client locale not available)
  const locale = DEFAULT_LOCALE;

  // ── Rank chart data + meta ──
  let rankChartData = prepareRankChartData(ranks, locale);
  let lpChartMeta = computeLPChartMeta(rankChartData);

  // Downsample rank data preserving key points
  if (lpChartMeta && rankChartData.length > MAX_CHART_POINTS) {
    const preserveIndices = new Set<number>([lpChartMeta.peakIndex]);
    for (const e of lpChartMeta.events) preserveIndices.add(e.index);
    for (const m of lpChartMeta.milestones) preserveIndices.add(m.index);

    rankChartData = lttbDownsample(
      rankChartData,
      MAX_CHART_POINTS,
      (d) => d.cumulativeLP,
      preserveIndices,
    );
    // Recompute meta with downsampled data (indices change)
    lpChartMeta = computeLPChartMeta(rankChartData);
  }

  // ── Win rate ──
  let rollingWR = computeRollingWinRate(allMatches, locale);
  const coachingBands = computeCoachingBands(allMatches, sessions, rollingWR.length);

  // Downsample win rate data
  if (rollingWR.length > MAX_CHART_POINTS) {
    // Preserve coaching session indices
    const preserveIndices = new Set<number>();
    for (const s of coachingBands.sessionIndices) {
      // Session index is 1-based, array is 0-based
      const arrIdx = rollingWR.findIndex((p) => p.index === s.index);
      if (arrIdx >= 0) preserveIndices.add(arrIdx);
    }

    const originalLength = rollingWR.length;
    rollingWR = lttbDownsample(rollingWR, MAX_CHART_POINTS, (d) => d.winRate, preserveIndices);

    // Remap coaching band indices to downsampled data
    const indexMap = new Map<number, number>();
    for (let i = 0; i < rollingWR.length; i++) {
      indexMap.set(rollingWR[i].index, i + 1);
    }

    // Remap session indices
    for (const s of coachingBands.sessionIndices) {
      const mapped = indexMap.get(s.index);
      if (mapped !== undefined) {
        s.index = mapped;
      } else {
        // Find closest downsampled point
        let closest = 1;
        let closestDist = Infinity;
        for (const [origIdx, newIdx] of indexMap) {
          const dist = Math.abs(origIdx - s.index);
          if (dist < closestDist) {
            closestDist = dist;
            closest = newIdx;
          }
        }
        s.index = closest;
      }
    }

    // Remap bands
    for (const band of coachingBands.bands) {
      const mappedX1 = indexMap.get(band.x1);
      const mappedX2 = indexMap.get(band.x2);
      if (mappedX1 !== undefined) band.x1 = mappedX1;
      if (mappedX2 !== undefined) band.x2 = mappedX2;
      // If x2 was the original length, map to new length
      if (band.x2 === originalLength) band.x2 = rollingWR.length;
    }

    // Re-index the downsampled win rate points sequentially
    for (let i = 0; i < rollingWR.length; i++) {
      rollingWR[i].index = i + 1;
    }
  }

  // ── Table data ──
  const matchupStats = computeMatchupStats(allMatches);
  const topMatchups = matchupStats.slice(0, 10);
  const runeStats = computeRuneStats(allMatches);
  const championStats = computeChampionStats(allMatches);

  const meaningfulCount = allMatches.filter((m) => m.result !== "Remake").length;

  // ── Goal ──
  const goalTargetLP = goal ? toCumulativeLP(goal.targetTier, goal.targetDivision, 0) : null;
  let goalTargetLabel = "";
  if (goal) {
    const tierName = goal.targetTier.charAt(0) + goal.targetTier.slice(1).toLowerCase();
    goalTargetLabel = goal.targetDivision ? `${tierName} ${goal.targetDivision}` : tierName;
  }

  return {
    rankChartData,
    lpChartMeta,
    rollingWR,
    coachingBands,
    topMatchups,
    runeStats,
    championStats,
    meaningfulCount,
    totalCount: allMatches.length,
    ddragonVersion,
    activeGoal: goal,
    goalTargetLP: goalTargetLP ?? null,
    goalTargetLabel,
  };
}

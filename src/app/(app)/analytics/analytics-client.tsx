"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, TrendingUp, Trophy, ArrowUpDown } from "lucide-react";
import type { RankSnapshot } from "@/db/schema";
import { getKeystoneIconUrlByName, getChampionIconUrl } from "@/lib/riot-api";
import { ChampionLink } from "@/components/champion-link";

// ─── LP / Rank Utilities ─────────────────────────────────────────────────────

const TIER_ORDER = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;

const DIVISION_ORDER = ["IV", "III", "II", "I"] as const;

// LP per division = 100, 4 divisions per tier (except Master+ which has no divisions)
const LP_PER_DIVISION = 100;
const DIVISIONS_PER_TIER = 4;
const LP_PER_TIER = LP_PER_DIVISION * DIVISIONS_PER_TIER; // 400

/**
 * Convert tier + division + lp into a single cumulative LP number.
 * Iron IV 0 LP = 0, Iron III 0 LP = 100, Bronze IV 0 LP = 400, etc.
 * Master+ tiers have no divisions, treated as division I.
 */
function toCumulativeLP(
  tier: string | null | undefined,
  division: string | null | undefined,
  lp: number | null | undefined
): number | null {
  if (!tier) return null;
  const tierIdx = TIER_ORDER.indexOf(tier.toUpperCase() as typeof TIER_ORDER[number]);
  if (tierIdx === -1) return null;

  // Master+ have no divisions — treat as single division
  const isMasterPlus = tierIdx >= TIER_ORDER.indexOf("MASTER");
  const divIdx = isMasterPlus
    ? 0
    : DIVISION_ORDER.indexOf((division || "IV") as typeof DIVISION_ORDER[number]);

  const baseLp = tierIdx * LP_PER_TIER;
  const divLp = (divIdx < 0 ? 0 : divIdx) * LP_PER_DIVISION;
  return baseLp + divLp + (lp || 0);
}

/** Get tier boundaries for reference lines within a given LP range */
function getTierBoundaries(
  minLP: number,
  maxLP: number
): Array<{ lp: number; label: string }> {
  const boundaries: Array<{ lp: number; label: string }> = [];
  for (let i = 0; i < TIER_ORDER.length; i++) {
    const boundary = i * LP_PER_TIER;
    if (boundary > minLP && boundary < maxLP) {
      const tierName =
        TIER_ORDER[i].charAt(0) + TIER_ORDER[i].slice(1).toLowerCase();
      boundaries.push({ lp: boundary, label: tierName });
    }
  }
  return boundaries;
}

/** Format cumulative LP back to human-readable rank string */
function formatRank(cumulativeLP: number): string {
  const tierIdx = Math.min(
    Math.floor(cumulativeLP / LP_PER_TIER),
    TIER_ORDER.length - 1
  );
  const tier = TIER_ORDER[tierIdx];
  const tierName = tier.charAt(0) + tier.slice(1).toLowerCase();

  const isMasterPlus = tierIdx >= TIER_ORDER.indexOf("MASTER");
  if (isMasterPlus) {
    const lp = cumulativeLP - tierIdx * LP_PER_TIER;
    return `${tierName} ${lp} LP`;
  }

  const lpInTier = cumulativeLP - tierIdx * LP_PER_TIER;
  const divIdx = Math.min(Math.floor(lpInTier / LP_PER_DIVISION), 3);
  const division = DIVISION_ORDER[divIdx];
  const lp = lpInTier - divIdx * LP_PER_DIVISION;
  return `${tierName} ${division} — ${lp} LP`;
}

/** Prepare rank snapshot data for the LP chart */
function prepareRankChartData(snapshots: RankSnapshot[]) {
  const data: Array<{
    date: string;
    cumulativeLP: number;
    tier: string;
    division: string;
    lp: number;
    wins: number;
    losses: number;
    timestamp: number;
  }> = [];

  for (const s of snapshots) {
    const clp = toCumulativeLP(s.tier, s.division, s.lp);
    if (clp === null) continue;

    const dateStr = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
    }).format(s.capturedAt);

    const tierName = s.tier
      ? s.tier.charAt(0) + s.tier.slice(1).toLowerCase()
      : "";

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

/** Slim match shape — only the 8 columns fetched by the analytics page */
interface AnalyticsMatch {
  gameDate: Date;
  result: string;
  championName: string;
  matchupChampionName: string | null;
  runeKeystoneName: string | null;
  kills: number;
  deaths: number;
  assists: number;
}

interface CoachingSessionSummary {
  id: number;
  coachName: string;
  date: Date;
  status: "scheduled" | "completed";
}

interface AnalyticsClientProps {
  matches: AnalyticsMatch[];
  coachingSessions: CoachingSessionSummary[];
  rankSnapshots: RankSnapshot[];
  ddragonVersion: string;
}

// Rolling win rate: for each match, calculate win rate of last N games
function computeRollingWinRate(
  matches: AnalyticsMatch[],
  window = 10
): Array<{ index: number; date: string; winRate: number }> {
  const data: Array<{ index: number; date: string; winRate: number }> = [];
  for (let i = 0; i < matches.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = matches.slice(start, i + 1);
    const wins = slice.filter((m) => m.result === "Victory").length;
    const wr = Math.round((wins / slice.length) * 100);
    const dateStr = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
    }).format(matches[i].gameDate);
    data.push({ index: i + 1, date: dateStr, winRate: wr });
  }
  return data;
}

function computeMatchupStats(matches: AnalyticsMatch[]) {
  const stats = new Map<
    string,
    { wins: number; losses: number; games: number }
  >();
  for (const m of matches) {
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

function computeRuneStats(matches: AnalyticsMatch[]) {
  const stats = new Map<
    string,
    { wins: number; losses: number; games: number }
  >();
  for (const m of matches) {
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

function computeChampionStats(matches: AnalyticsMatch[]) {
  const stats = new Map<
    string,
    {
      wins: number;
      losses: number;
      games: number;
      kills: number;
      deaths: number;
      assists: number;
    }
  >();
  for (const m of matches) {
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
      avgKDA:
        s.deaths === 0
          ? "Perfect"
          : ((s.kills + s.assists) / s.deaths).toFixed(1),
    }))
    .sort((a, b) => b.games - a.games);
}

export function AnalyticsClient({
  matches,
  coachingSessions,
  rankSnapshots,
  ddragonVersion,
}: AnalyticsClientProps) {
  const rollingWR = useMemo(() => computeRollingWinRate(matches), [matches]);
  const matchupStats = useMemo(() => computeMatchupStats(matches), [matches]);
  const runeStats = useMemo(() => computeRuneStats(matches), [matches]);
  const championStats = useMemo(
    () => computeChampionStats(matches),
    [matches]
  );
  const rankChartData = useMemo(
    () => prepareRankChartData(rankSnapshots),
    [rankSnapshots]
  );

  // ─── Sort state for Rune Keystones table ──────────────────────────────────
  type RuneSortKey = "games" | "winRate";
  const [runeSortKey, setRuneSortKey] = useState<RuneSortKey>("games");
  const [runeSortDesc, setRuneSortDesc] = useState(true);

  const sortedRuneStats = useMemo(() => {
    return [...runeStats].sort((a, b) => {
      const aVal = a[runeSortKey];
      const bVal = b[runeSortKey];
      return runeSortDesc ? bVal - aVal : aVal - bVal;
    });
  }, [runeStats, runeSortKey, runeSortDesc]);

  function toggleRuneSort(key: RuneSortKey) {
    if (runeSortKey === key) {
      setRuneSortDesc((d) => !d);
    } else {
      setRuneSortKey(key);
      setRuneSortDesc(true);
    }
  }

  // ─── Sort state for Champion Stats table ──────────────────────────────────
  type ChampSortKey = "games" | "winRate" | "avgKDA";
  const [champSortKey, setChampSortKey] = useState<ChampSortKey>("games");
  const [champSortDesc, setChampSortDesc] = useState(true);

  const sortedChampionStats = useMemo(() => {
    return [...championStats].sort((a, b) => {
      if (champSortKey === "avgKDA") {
        const aVal = a.avgKDA === "Perfect" ? 999 : parseFloat(a.avgKDA);
        const bVal = b.avgKDA === "Perfect" ? 999 : parseFloat(b.avgKDA);
        return champSortDesc ? bVal - aVal : aVal - bVal;
      }
      const aVal = a[champSortKey];
      const bVal = b[champSortKey];
      return champSortDesc ? bVal - aVal : aVal - bVal;
    });
  }, [championStats, champSortKey, champSortDesc]);

  function toggleChampSort(key: ChampSortKey) {
    if (champSortKey === key) {
      setChampSortDesc((d) => !d);
    } else {
      setChampSortKey(key);
      setChampSortDesc(true);
    }
  }

  // Coaching session indices for shaded bands between consecutive sessions
  const coachingBands = useMemo(() => {
    // Map each session to its closest match index
    const sessionIndices = coachingSessions.map((s) => {
      const sessionTime = s.date.getTime();
      let closestIdx = 0;
      let closestDiff = Infinity;
      for (let i = 0; i < matches.length; i++) {
        const diff = Math.abs(matches[i].gameDate.getTime() - sessionTime);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIdx = i;
        }
      }
      return { index: closestIdx + 1, coachName: s.coachName, status: s.status };
    });

    // Build bands between consecutive sessions
    const bands: Array<{
      x1: number;
      x2: number;
      label: string;
      isOngoing: boolean;
    }> = [];
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
    // If there's at least one session, add a trailing band from last session to end
    if (sessionIndices.length > 0) {
      const last = sessionIndices[sessionIndices.length - 1];
      if (last.index < rollingWR.length) {
        bands.push({
          x1: last.index,
          x2: rollingWR.length,
          label: last.coachName,
          isOngoing: last.status === "scheduled",
        });
      }
    }
    return { sessionIndices, bands };
  }, [matches, coachingSessions, rollingWR.length]);

  // Top matchup data for bar chart (top 10 by games played)
  const topMatchups = matchupStats.slice(0, 10);

  // LP chart: compute boundaries and promotion/demotion markers
  const lpChartMeta = useMemo(() => {
    if (rankChartData.length < 2) return null;

    const allLP = rankChartData.map((d) => d.cumulativeLP);
    const minLP = Math.min(...allLP);
    const maxLP = Math.max(...allLP);
    // Add some padding
    const padding = Math.max((maxLP - minLP) * 0.1, 20);
    const yMin = Math.max(0, Math.floor((minLP - padding) / 100) * 100);
    const yMax = Math.ceil((maxLP + padding) / 100) * 100;

    const tierBoundaries = getTierBoundaries(yMin, yMax);

    // Detect tier changes (framed as milestones, not promotions/demotions)
    const events: Array<{
      index: number;
      type: "promotion" | "demotion";
      from: string;
      to: string;
    }> = [];
    for (let i = 1; i < rankChartData.length; i++) {
      const prev = rankChartData[i - 1];
      const curr = rankChartData[i];
      if (prev.tier !== curr.tier) {
        events.push({
          index: i,
          type: curr.cumulativeLP > prev.cumulativeLP ? "promotion" : "demotion",
          from: `${prev.tier} ${prev.division}`,
          to: `${curr.tier} ${curr.division}`,
        });
      }
    }

    // Net LP change
    const first = rankChartData[0];
    const last = rankChartData[rankChartData.length - 1];
    const netChange = last.cumulativeLP - first.cumulativeLP;

    // Peak rank achieved (highest cumulative LP point)
    let peakIndex = 0;
    let peakLP = rankChartData[0].cumulativeLP;
    for (let i = 1; i < rankChartData.length; i++) {
      if (rankChartData[i].cumulativeLP > peakLP) {
        peakLP = rankChartData[i].cumulativeLP;
        peakIndex = i;
      }
    }
    const peakRank = formatRank(peakLP);

    // First-time-in-tier milestones: detect the first snapshot where a tier appears
    const seenTiers = new Set<string>();
    const milestones: Array<{ index: number; tier: string }> = [];
    for (let i = 0; i < rankChartData.length; i++) {
      const tier = rankChartData[i].tier;
      if (tier && !seenTiers.has(tier)) {
        seenTiers.add(tier);
        // Skip the very first data point — that's just the starting tier, not a milestone
        if (i > 0) {
          milestones.push({ index: i, tier });
        }
      }
    }

    return { yMin, yMax, tierBoundaries, events, netChange, peakIndex, peakRank, milestones };
  }, [rankChartData]);

  if (matches.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">Analytics</h1>
          <p className="text-muted-foreground">
            Import some games first to see your analytics.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">No data yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Fetch your ranked games to see charts and statistics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">Analytics</h1>
        <p className="text-muted-foreground">
          {matches.length} games analyzed.
        </p>
      </div>

      {/* Rank Journey + Win Rate side-by-side */}
      <div className="grid gap-6 lg:grid-cols-2">
      {rankChartData.length >= 2 && lpChartMeta ? (
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" />
              Rank Journey
            </CardTitle>
            <CardDescription>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{rankChartData.length} rank updates tracked</span>
                <span className="font-medium text-foreground/80">
                  Peak: {lpChartMeta.peakRank}
                </span>
                {lpChartMeta.netChange !== 0 && (
                  <span
                    className={`font-mono font-semibold ${
                      lpChartMeta.netChange >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {lpChartMeta.netChange >= 0 ? "+" : ""}
                    {lpChartMeta.netChange} LP overall
                  </span>
                )}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rankChartData}>
                  <defs>
                    <linearGradient id="lpGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.78 0.14 80)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.78 0.14 80)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 260)" />
                  <XAxis
                    dataKey="date"
                    stroke="oklch(0.55 0.02 260)"
                    fontSize={12}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="oklch(0.55 0.02 260)"
                    fontSize={12}
                    domain={[lpChartMeta.yMin, lpChartMeta.yMax]}
                    tickFormatter={(v: number) => formatRank(v).split("—")[0].trim()}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.18 0.03 260)",
                      border: "1px solid oklch(0.25 0.03 260)",
                      borderRadius: "8px",
                    }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload[0]) return null;
                      const d = payload[0].payload as (typeof rankChartData)[0];
                      const idx = rankChartData.findIndex((r) => r.timestamp === d.timestamp);
                      const isPeak = idx === lpChartMeta.peakIndex;
                      const milestone = lpChartMeta.milestones.find((m) => m.index === idx);
                      return (
                        <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 shadow-lg">
                          {isPeak && (
                            <p className="text-xs font-semibold text-gold mb-1">Peak Rank Achieved</p>
                          )}
                          {milestone && (
                            <p className="text-xs font-semibold text-green-400 mb-1">First time in {milestone.tier}!</p>
                          )}
                          <p className="font-semibold text-gold">
                            {d.tier} {d.division}
                          </p>
                          <p className="text-sm">
                            <span className="text-gold/80">{d.lp} LP</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {d.wins}W {d.losses}L &middot; {d.date}
                          </p>
                        </div>
                      );
                    }}
                  />
                  {/* Tier boundary reference lines */}
                  {lpChartMeta.tierBoundaries.map((b) => (
                    <ReferenceLine
                      key={b.label}
                      y={b.lp}
                      stroke="oklch(0.65 0.17 250)"
                      strokeDasharray="6 3"
                      label={{
                        value: b.label,
                        fill: "oklch(0.65 0.17 250)",
                        fontSize: 11,
                        position: "right",
                      }}
                    />
                  ))}
                  {/* Promotion/demotion markers */}
                  {lpChartMeta.events.map((e, i) => (
                    <ReferenceLine
                      key={`event-${i}`}
                      x={rankChartData[e.index].date}
                      stroke={
                        e.type === "promotion"
                          ? "oklch(0.72 0.15 150)"
                          : "oklch(0.65 0.22 27)"
                      }
                      strokeDasharray="4 4"
                      label={{
                        value: e.type === "promotion" ? `Reached ${e.to.split(" ")[0]}` : `Back to ${e.to.split(" ")[0]}`,
                        fill:
                          e.type === "promotion"
                            ? "oklch(0.72 0.15 150)"
                            : "oklch(0.65 0.22 27)",
                        fontSize: 10,
                        position: "top",
                      }}
                    />
                  ))}
                  <Area
                    type="monotone"
                    dataKey="cumulativeLP"
                    stroke="oklch(0.78 0.14 80)"
                    strokeWidth={2}
                    fill="url(#lpGradient)"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    dot={(props: any) => {
                      // Highlight promotion/demotion points
                      const isEvent = lpChartMeta.events.some(
                        (e: { index: number }) => e.index === props.index
                      );
                      // Highlight peak rank point
                      const isPeak = props.index === lpChartMeta.peakIndex;
                      if (isPeak) {
                        return (
                          <g key={props.index}>
                            <circle
                              cx={props.cx}
                              cy={props.cy}
                              r={6}
                              fill="oklch(0.78 0.14 80)"
                              stroke="oklch(0.90 0.14 80)"
                              strokeWidth={2}
                            />
                            <text
                              x={props.cx}
                              y={props.cy - 12}
                              textAnchor="middle"
                              fill="oklch(0.85 0.12 80)"
                              fontSize={9}
                              fontWeight="bold"
                            >
                              Peak
                            </text>
                          </g>
                        );
                      }
                      if (isEvent) {
                        return (
                          <circle
                            key={props.index}
                            cx={props.cx}
                            cy={props.cy}
                            r={5}
                            fill="oklch(0.78 0.14 80)"
                            stroke="oklch(0.13 0.02 260)"
                            strokeWidth={2}
                          />
                        );
                      }
                      return (
                        <circle
                          key={props.index}
                          cx={props.cx}
                          cy={props.cy}
                          r={2}
                          fill="oklch(0.78 0.14 80)"
                          opacity={0.5}
                        />
                      );
                    }}
                    activeDot={{ r: 5, fill: "oklch(0.85 0.12 80)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" />
              Rank Journey
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Not enough rank data yet. Play more ranked games to see your LP journey.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Win Rate Over Time */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gold" />
            Win Rate Over Time (10-game rolling)
          </CardTitle>
          <CardDescription>
            {coachingBands.bands.length > 0
              ? "Shaded areas show the time between coaching sessions."
              : "No coaching sessions to show."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rollingWR}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 260)" />
                <XAxis
                  dataKey="date"
                  stroke="oklch(0.55 0.02 260)"
                  fontSize={12}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="oklch(0.55 0.02 260)"
                  fontSize={12}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  cursor={{ stroke: "oklch(0.45 0.02 260)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload[0]) return null;
                    const d = payload[0].payload as (typeof rollingWR)[0];
                    return (
                      <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 shadow-lg">
                        <p className="text-sm font-semibold text-foreground">{d.date}</p>
                        <p className="text-sm">
                          Win Rate:{" "}
                          <span className={d.winRate >= 50 ? "text-gold" : "text-red-400"}>
                            {d.winRate}%
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">Game #{d.index}</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={50}
                  stroke="oklch(0.35 0.02 260)"
                  strokeDasharray="3 3"
                  label={{ value: "50%", fill: "oklch(0.55 0.02 260)", fontSize: 11 }}
                />
                {/* Shaded bands between coaching sessions */}
                {coachingBands.bands.map((band, i) => (
                  <ReferenceArea
                    key={`band-${i}`}
                    x1={band.x1}
                    x2={band.x2}
                    fill={band.isOngoing ? "oklch(0.6 0.2 300 / 0.08)" : "oklch(0.6 0.2 300 / 0.12)"}
                    fillOpacity={1}
                    strokeOpacity={0}
                  />
                ))}
                {/* Coaching session markers (vertical lines at each session) */}
                {coachingBands.sessionIndices.map((s, i) => (
                  <ReferenceLine
                    key={`session-${i}`}
                    x={s.index}
                    stroke={s.status === "scheduled" ? "oklch(0.6 0.2 300 / 0.6)" : "oklch(0.6 0.2 300)"}
                    strokeDasharray={s.status === "scheduled" ? "6 4" : "4 4"}
                    label={{
                      value: s.coachName,
                      fill: "oklch(0.6 0.2 300)",
                      fontSize: 10,
                      position: "top",
                    }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="winRate"
                  stroke="oklch(0.78 0.14 80)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Matchup Win Rates */}
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle>Matchup Win Rates</CardTitle>
            <CardDescription>Top 10 most-played matchups</CardDescription>
          </CardHeader>
          <CardContent>
            {topMatchups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matchup data yet. Play more games to see win rates by matchup.</p>
            ) : (
            <div style={{ height: Math.max(200, topMatchups.length * 40 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topMatchups} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 260)" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    stroke="oklch(0.55 0.02 260)"
                    fontSize={12}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    stroke="oklch(0.55 0.02 260)"
                    fontSize={12}
                    tick={({ x, y, payload }: { x: string | number; y: string | number; payload: { value: string } }) => (
                      <a href={`/scout?enemy=${encodeURIComponent(payload.value)}`}>
                        <g transform={`translate(${x},${y})`} style={{ cursor: "pointer" }}>
                          <image
                            href={getChampionIconUrl(ddragonVersion, payload.value)}
                            x={-98}
                            y={-10}
                            width={20}
                            height={20}
                            clipPath="inset(0 round 2px)"
                          />
                          <text
                            x={-74}
                            y={0}
                            dy={4}
                            fill="oklch(0.75 0.02 260)"
                            fontSize={12}
                            textAnchor="start"
                          >
                            {payload.value}
                          </text>
                        </g>
                      </a>
                    )}
                  />
                  <Tooltip
                    cursor={{ fill: "oklch(0.25 0.03 260 / 0.3)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload[0]) return null;
                      const d = payload[0].payload as (typeof topMatchups)[0];
                      return (
                        <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 shadow-lg">
                          <p className="font-semibold text-foreground">{d.name}</p>
                          <p className="text-sm">
                            Win Rate:{" "}
                            <span className={d.winRate >= 50 ? "text-gold" : "text-red-400"}>
                              {d.winRate}%
                            </span>{" "}
                            <span className="text-muted-foreground">
                              ({d.wins}W {d.losses}L / {d.games} games)
                            </span>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine x={50} stroke="oklch(0.35 0.02 260)" strokeDasharray="3 3" />
                  <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                    {topMatchups.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.winRate >= 50 ? "oklch(0.78 0.14 80)" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
          </CardContent>
        </Card>

        {/* Rune Comparison */}
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle>Rune Keystones</CardTitle>
            <CardDescription>Win rate by keystone rune</CardDescription>
          </CardHeader>
          <CardContent>
            {runeStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rune data available.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keystone</TableHead>
                    <TableHead className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-1.5 -ml-1.5"
                        onClick={() => toggleRuneSort("games")}
                      >
                        Games
                        {runeSortKey === "games" && (
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-1.5 -ml-1.5"
                        onClick={() => toggleRuneSort("winRate")}
                      >
                        Win Rate
                        {runeSortKey === "winRate" && (
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">W/L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRuneStats.map((rune) => (
                    <TableRow key={rune.name}>
                      <TableCell className="font-medium text-sm">
                        <span className="flex items-center gap-1.5">
                          {(() => {
                            const url = getKeystoneIconUrlByName(rune.name);
                            return url ? (
                              <Image src={url} alt={rune.name} width={18} height={18} className="rounded" />
                            ) : null;
                          })()}
                          {rune.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {rune.games}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            rune.winRate >= 50 ? "default" : "destructive"
                          }
                          className="text-xs"
                        >
                          {rune.winRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {rune.wins}W {rune.losses}L
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Champion Stats */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle>Champion Stats</CardTitle>
          <CardDescription>Performance by champion</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedChampionStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No champion data yet. Play some games to see your champion stats.</p>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Champion</TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-1.5 -ml-1.5"
                    onClick={() => toggleChampSort("games")}
                  >
                    Games
                    {champSortKey === "games" && (
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-1.5 -ml-1.5"
                    onClick={() => toggleChampSort("winRate")}
                  >
                    Win Rate
                    {champSortKey === "winRate" && (
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="text-center">W/L</TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-1.5 -ml-1.5"
                    onClick={() => toggleChampSort("avgKDA")}
                  >
                    Avg KDA
                    {champSortKey === "avgKDA" && (
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    )}
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedChampionStats.map((champ) => (
                <TableRow key={champ.name}>
                  <TableCell className="font-medium text-sm">
                    <ChampionLink
                      champion={champ.name}
                      ddragonVersion={ddragonVersion}
                      linkTo="scout-your"
                      iconSize={24}
                      textClassName="font-medium text-sm"
                    />
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {champ.games}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        champ.winRate >= 50 ? "default" : "destructive"
                      }
                      className="text-xs"
                    >
                      {champ.winRate}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {champ.wins}W {champ.losses}L
                  </TableCell>
                  <TableCell className="text-center text-sm font-mono">
                    {champ.avgKDA}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useChartColors } from "@/hooks/use-chart-colors";
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
import { formatDate, DEFAULT_LOCALE } from "@/lib/format";
import { toCumulativeLP, getTierBoundaries, formatRank } from "@/lib/rank";
import { filterMeaningful } from "@/lib/match-result";
import { ChampionLink } from "@/components/champion-link";

/** Prepare rank snapshot data for the LP chart */
function prepareRankChartData(snapshots: RankSnapshot[], locale: string) {
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

    const dateStr = formatDate(s.capturedAt, locale, "short-compact");

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
  activeGoal: { targetTier: string; targetDivision: string | null } | null;
}

// Rolling win rate: for each match, calculate win rate of last N games
function computeRollingWinRate(
  matches: AnalyticsMatch[],
  locale: string,
  window = 10
): Array<{ index: number; date: string; winRate: number }> {
  // Exclude remakes from rolling win rate
  const meaningful = matches.filter((m) => m.result !== "Remake");
  const data: Array<{ index: number; date: string; winRate: number }> = [];
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

function computeMatchupStats(matches: AnalyticsMatch[]) {
  const stats = new Map<
    string,
    { wins: number; losses: number; games: number }
  >();
  for (const m of matches) {
    if (m.result === "Remake") continue; // Skip remakes
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
    if (m.result === "Remake") continue; // Skip remakes
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
    if (m.result === "Remake") continue; // Skip remakes
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
  activeGoal,
}: AnalyticsClientProps) {
  const { data: session } = useSession();
  const locale = session?.user?.locale ?? DEFAULT_LOCALE;
  const t = useTranslations("Analytics");
  const cc = useChartColors();

  const rollingWR = useMemo(() => computeRollingWinRate(matches, locale), [matches, locale]);
  const matchupStats = useMemo(() => computeMatchupStats(matches), [matches]);
  const runeStats = useMemo(() => computeRuneStats(matches), [matches]);
  const championStats = useMemo(
    () => computeChampionStats(matches),
    [matches]
  );
  const rankChartData = useMemo(
    () => prepareRankChartData(rankSnapshots, locale),
    [rankSnapshots, locale]
  );

  // Compute goal target cumulative LP for chart reference line
  const goalTargetLP = useMemo(() => {
    if (!activeGoal) return null;
    return toCumulativeLP(activeGoal.targetTier, activeGoal.targetDivision, 0);
  }, [activeGoal]);

  const goalTargetLabel = useMemo(() => {
    if (!activeGoal) return "";
    const tierName =
      activeGoal.targetTier.charAt(0) +
      activeGoal.targetTier.slice(1).toLowerCase();
    return activeGoal.targetDivision
      ? `${tierName} ${activeGoal.targetDivision}`
      : tierName;
  }, [activeGoal]);

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
  // Must use the same filtered (remake-excluded) array that rollingWR uses,
  // so band indices align with chart x-axis values.
  const coachingBands = useMemo(() => {
    const meaningful = matches.filter((m) => m.result !== "Remake");
    // Map each session to its closest match index in the filtered array
    const sessionIndices = coachingSessions.map((s) => {
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

  // Adjusted tier boundaries — extends range to include goal target if present
  const adjustedTierBoundaries = useMemo(() => {
    if (!lpChartMeta || goalTargetLP === null) return null;
    const yMin = Math.min(lpChartMeta.yMin, Math.floor((goalTargetLP - 50) / 100) * 100);
    const yMax = Math.max(lpChartMeta.yMax, Math.ceil((goalTargetLP + 50) / 100) * 100);
    // Only recompute if range actually expanded
    if (yMin < lpChartMeta.yMin || yMax > lpChartMeta.yMax) {
      return getTierBoundaries(yMin, yMax);
    }
    return null; // Use original
  }, [lpChartMeta, goalTargetLP]);

  const meaningfulCount = useMemo(() => filterMeaningful(matches).length, [matches]);

  if (matches.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">{t("pageTitle")}</h1>
          <p className="text-muted-foreground">
            {t("importGamesFirst")}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">{t("noDataYetTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("noDataYetDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">
          {t("gamesAnalyzed", { count: meaningfulCount })}
        </p>
      </div>

      {/* Rank Journey + Win Rate side-by-side */}
      <div className="grid gap-6 lg:grid-cols-2">
      {rankChartData.length >= 2 && lpChartMeta ? (
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" />
              {t("rankJourney")}
            </CardTitle>
            <CardDescription>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium text-foreground/80">
                  {t("peakLabel", { rank: lpChartMeta.peakRank })}
                </span>
                {lpChartMeta.netChange !== 0 && (
                  <span
                    className={`font-mono font-semibold ${
                      lpChartMeta.netChange >= 0 ? "text-win" : "text-loss"
                    }`}
                  >
                    {lpChartMeta.netChange >= 0 ? "+" : ""}
                    {t("lpOverall", { value: lpChartMeta.netChange })}
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
                      <stop offset="5%" stopColor={cc.gold} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={cc.gold} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={cc.chartGrid} />
                  <XAxis
                    dataKey="date"
                    stroke={cc.chartAxis}
                    fontSize={12}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke={cc.chartAxis}
                    fontSize={12}
                    domain={[
                      goalTargetLP !== null
                        ? Math.min(lpChartMeta.yMin, Math.floor((goalTargetLP - 50) / 100) * 100)
                        : lpChartMeta.yMin,
                      goalTargetLP !== null
                        ? Math.max(lpChartMeta.yMax, Math.ceil((goalTargetLP + 50) / 100) * 100)
                        : lpChartMeta.yMax,
                    ]}
                    tickFormatter={(v: number) => formatRank(v).split("—")[0].trim()}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: cc.chartTooltipBg,
                      border: `1px solid ${cc.chartTooltipBorder}`,
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
                            <p className="text-xs font-semibold text-gold mb-1">{t("tooltips.peakRankAchieved")}</p>
                          )}
                          {milestone && (
                            <p className="text-xs font-semibold text-win mb-1">{t("tooltips.firstTimeInTier", { tier: milestone.tier })}</p>
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
                  {(adjustedTierBoundaries ?? lpChartMeta.tierBoundaries).map((b) => (
                    <ReferenceLine
                      key={b.label}
                      y={b.lp}
                      stroke={cc.electric}
                      strokeDasharray="6 3"
                      label={{
                        value: b.label,
                        fill: cc.electric,
                        fontSize: 11,
                        position: "right",
                      }}
                    />
                  ))}
                  {/* Goal target reference line */}
                  {goalTargetLP !== null && (
                    <ReferenceLine
                      y={goalTargetLP}
                      stroke={cc.gold}
                      strokeDasharray="8 4"
                      strokeWidth={2}
                      label={({ viewBox }: { viewBox: { x: number; y: number } }) => {
                        const label = t("chartLabels.goalTarget", { rank: goalTargetLabel });
                        return (
                          <g>
                            {/* Target/crosshair icon */}
                            <g transform={`translate(${viewBox.x + 4}, ${viewBox.y - 8})`}>
                              <circle cx="6" cy="6" r="5" fill="none" stroke={cc.gold} strokeWidth="1.5" />
                              <circle cx="6" cy="6" r="2" fill={cc.gold} />
                              <line x1="6" y1="0" x2="6" y2="2.5" stroke={cc.gold} strokeWidth="1.5" />
                              <line x1="6" y1="9.5" x2="6" y2="12" stroke={cc.gold} strokeWidth="1.5" />
                              <line x1="0" y1="6" x2="2.5" y2="6" stroke={cc.gold} strokeWidth="1.5" />
                              <line x1="9.5" y1="6" x2="12" y2="6" stroke={cc.gold} strokeWidth="1.5" />
                            </g>
                            <text
                              x={viewBox.x + 20}
                              y={viewBox.y - 3}
                              fill={cc.gold}
                              fontSize={11}
                              fontWeight="bold"
                            >
                              {label}
                            </text>
                          </g>
                        );
                      }}
                    />
                  )}
                  {/* Promotion/demotion markers */}
                  {lpChartMeta.events.map((e, i) => (
                    <ReferenceLine
                      key={`event-${i}`}
                      x={rankChartData[e.index].date}
                      stroke={
                        e.type === "promotion"
                          ? cc.chartPromotion
                          : cc.chartDemotion
                      }
                      strokeDasharray="4 4"
                      label={{
                        value: e.type === "promotion" ? t("chartLabels.reached", { tier: e.to.split(" ")[0] }) : t("chartLabels.backTo", { tier: e.to.split(" ")[0] }),
                        fill:
                          e.type === "promotion"
                            ? cc.chartPromotion
                            : cc.chartDemotion,
                        fontSize: 10,
                        position: "top",
                      }}
                    />
                  ))}
                  <Area
                    type="monotone"
                    dataKey="cumulativeLP"
                    stroke={cc.gold}
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
                              fill={cc.gold}
                              stroke={cc.goldLight}
                              strokeWidth={2}
                            />
                            <text
                              x={props.cx}
                              y={props.cy - 12}
                              textAnchor="middle"
                              fill={cc.goldLight}
                              fontSize={9}
                              fontWeight="bold"
                            >
                              {t("peak")}
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
                            fill={cc.gold}
                            stroke={cc.background}
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
                          fill={cc.gold}
                          opacity={0.5}
                        />
                      );
                    }}
                    activeDot={{ r: 5, fill: cc.goldLight }}
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
              {t("rankJourney")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("notEnoughRankData")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Win Rate Over Time */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gold" />
            {t("winRateOverTime")}
          </CardTitle>
          <CardDescription>
            {coachingBands.bands.length > 0
              ? t("coachingBandsDescription")
              : t("noCoachingSessions")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rollingWR}>
                <CartesianGrid strokeDasharray="3 3" stroke={cc.chartGrid} />
                <XAxis
                  dataKey="date"
                  stroke={cc.chartAxis}
                  fontSize={12}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke={cc.chartAxis}
                  fontSize={12}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  cursor={{ stroke: cc.chartReference }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload[0]) return null;
                    const d = payload[0].payload as (typeof rollingWR)[0];
                    return (
                      <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 shadow-lg">
                        <p className="text-sm font-semibold text-foreground">{d.date}</p>
                        <p className="text-sm">
                          {t("tooltips.winRate")}{" "}
                          <span className={d.winRate >= 50 ? "text-gold" : "text-loss"}>
                            {d.winRate}%
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">{t("tooltips.gameNumber", { index: d.index })}</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={50}
                  stroke={cc.chartReference}
                  strokeDasharray="3 3"
                  label={{ value: "50%", fill: cc.chartAxis, fontSize: 11 }}
                />
                {/* Shaded bands between coaching sessions */}
                {coachingBands.bands.map((band, i) => (
                  <ReferenceArea
                    key={`band-${i}`}
                    x1={band.x1}
                    x2={band.x2}
                    fill={cc.neonPurple}
                    fillOpacity={band.isOngoing ? 0.08 : 0.12}
                    strokeOpacity={0}
                  />
                ))}
                {/* Coaching session markers (vertical lines at each session) */}
                {coachingBands.sessionIndices.map((s, i) => (
                  <ReferenceLine
                    key={`session-${i}`}
                    x={s.index}
                    stroke={cc.neonPurple}
                    strokeOpacity={s.status === "scheduled" ? 0.6 : 1}
                    strokeDasharray={s.status === "scheduled" ? "6 4" : "4 4"}
                    label={{
                      value: s.coachName,
                      fill: cc.neonPurple,
                      fontSize: 10,
                      position: "top",
                    }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="winRate"
                  stroke={cc.gold}
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
            <CardTitle>{t("matchupWinRates")}</CardTitle>
            <CardDescription>{t("topMatchupsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {topMatchups.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noMatchupData")}</p>
            ) : (
            <div style={{ height: Math.max(200, topMatchups.length * 40 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topMatchups} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={cc.chartGrid} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    stroke={cc.chartAxis}
                    fontSize={12}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    stroke={cc.chartAxis}
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
                            fill={cc.mutedForeground}
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
                    cursor={{ fill: `color-mix(in oklch, ${cc.chartGrid}, transparent 70%)` }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload[0]) return null;
                      const d = payload[0].payload as (typeof topMatchups)[0];
                      return (
                        <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 shadow-lg">
                          <p className="font-semibold text-foreground">{d.name}</p>
                          <p className="text-sm">
                            Win Rate:{" "}
                            <span className={d.winRate >= 50 ? "text-gold" : "text-loss"}>
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
                  <ReferenceLine x={50} stroke={cc.chartReference} strokeDasharray="3 3" />
                  <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                    {topMatchups.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.winRate >= 50 ? cc.gold : cc.loss}
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
            <CardTitle>{t("runeKeystones")}</CardTitle>
            <CardDescription>{t("runeKeystonesDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {runeStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noRuneData")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tableHeaders.keystone")}</TableHead>
                    <TableHead className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-1.5 -ml-1.5"
                        onClick={() => toggleRuneSort("games")}
                      >
                        {t("tableHeaders.games")}
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
                        {t("tableHeaders.winRate")}
                        {runeSortKey === "winRate" && (
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">{t("tableHeaders.wl")}</TableHead>
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
          <CardTitle>{t("championStats")}</CardTitle>
          <CardDescription>{t("championStatsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedChampionStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noChampionData")}</p>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tableHeaders.champion")}</TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-1.5 -ml-1.5"
                    onClick={() => toggleChampSort("games")}
                  >
                    {t("tableHeaders.games")}
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
                    {t("tableHeaders.winRate")}
                    {champSortKey === "winRate" && (
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="text-center">{t("tableHeaders.wl")}</TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-1.5 -ml-1.5"
                    onClick={() => toggleChampSort("avgKDA")}
                  >
                    {t("tableHeaders.avgKda")}
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
                    {champ.avgKDA === "Perfect" ? t("perfectKda") : champ.avgKDA}
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

"use client";

import { useMemo } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, TrendingUp, Trophy } from "lucide-react";
import type { Match, RankSnapshot } from "@/db/schema";
import { getKeystoneIconUrlByName } from "@/lib/riot-api";

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

interface CoachingSessionSummary {
  id: number;
  coachName: string;
  date: Date;
}

interface AnalyticsClientProps {
  matches: Match[];
  coachingSessions: CoachingSessionSummary[];
  rankSnapshots: RankSnapshot[];
}

// Rolling win rate: for each match, calculate win rate of last N games
function computeRollingWinRate(
  matches: Match[],
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

function computeMatchupStats(matches: Match[]) {
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

function computeRuneStats(matches: Match[]) {
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

function computeChampionStats(matches: Match[]) {
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

  // Coaching session indices for reference lines
  const coachingIndices = useMemo(() => {
    return coachingSessions.map((s) => {
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
      return { index: closestIdx + 1, coachName: s.coachName };
    });
  }, [matches, coachingSessions]);

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

    // Detect promotions/demotions
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

    return { yMin, yMax, tierBoundaries, events, netChange };
  }, [rankChartData]);

  if (matches.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">Analytics</h1>
          <p className="text-muted-foreground">
            Sync some games first to see your analytics.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">No data yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Sync your ranked games to see charts and statistics.
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

      {/* LP Over Time */}
      {rankChartData.length >= 2 && lpChartMeta && (
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" />
              LP Over Time
            </CardTitle>
            <CardDescription className="flex items-center gap-3">
              <span>Rank progression across {rankChartData.length} snapshots</span>
              <span
                className={`font-mono font-semibold ${
                  lpChartMeta.netChange >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {lpChartMeta.netChange >= 0 ? "+" : ""}
                {lpChartMeta.netChange} LP net
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
                      return (
                        <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 shadow-lg">
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
                        value: e.type === "promotion" ? "Promoted" : "Demoted",
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
      )}

      {/* Win Rate Over Time */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gold" />
            Win Rate Over Time (10-game rolling)
          </CardTitle>
          <CardDescription>
            Dotted lines show coaching sessions.
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
                  contentStyle={{
                    backgroundColor: "oklch(0.18 0.03 260)",
                    border: "1px solid oklch(0.25 0.03 260)",
                    borderRadius: "8px",
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`${value}%`, "Win Rate"]}
                />
                <ReferenceLine
                  y={50}
                  stroke="oklch(0.35 0.02 260)"
                  strokeDasharray="3 3"
                  label={{ value: "50%", fill: "oklch(0.55 0.02 260)", fontSize: 11 }}
                />
                {coachingIndices.map((c, i) => (
                  <ReferenceLine
                    key={i}
                    x={c.index}
                    stroke="oklch(0.6 0.2 300)"
                    strokeDasharray="4 4"
                    label={{
                      value: c.coachName,
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Matchup Win Rates */}
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle>Matchup Win Rates</CardTitle>
            <CardDescription>Top 10 most-played matchups</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
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
                    width={90}
                    stroke="oklch(0.55 0.02 260)"
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.18 0.03 260)",
                      border: "1px solid oklch(0.25 0.03 260)",
                      borderRadius: "8px",
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, _: any, entry: any) => [
                      `${value}% (${entry.payload.wins}W ${entry.payload.losses}L / ${entry.payload.games} games)`,
                      "Win Rate",
                    ]}
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
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keystone</TableHead>
                    <TableHead className="text-center">Games</TableHead>
                    <TableHead className="text-center">Win Rate</TableHead>
                    <TableHead className="text-center">W/L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runeStats.map((rune) => (
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Champion</TableHead>
                <TableHead className="text-center">Games</TableHead>
                <TableHead className="text-center">Win Rate</TableHead>
                <TableHead className="text-center">W/L</TableHead>
                <TableHead className="text-center">Avg KDA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {championStats.map((champ) => (
                <TableRow key={champ.name}>
                  <TableCell className="font-medium text-sm">
                    {champ.name}
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
        </CardContent>
      </Card>
    </div>
  );
}

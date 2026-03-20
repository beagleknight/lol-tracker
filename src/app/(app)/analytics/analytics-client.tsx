"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
import { BarChart3, TrendingUp } from "lucide-react";
import type { Match, RankSnapshot } from "@/db/schema";

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
}: AnalyticsClientProps) {
  const rollingWR = useMemo(() => computeRollingWinRate(matches), [matches]);
  const matchupStats = useMemo(() => computeMatchupStats(matches), [matches]);
  const runeStats = useMemo(() => computeRuneStats(matches), [matches]);
  const championStats = useMemo(
    () => computeChampionStats(matches),
    [matches]
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

  if (matches.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
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
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          {matches.length} games analyzed.
        </p>
      </div>

      {/* Win Rate Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="date"
                  stroke="#888"
                  fontSize={12}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#888"
                  fontSize={12}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`${value}%`, "Win Rate"]}
                />
                <ReferenceLine
                  y={50}
                  stroke="#666"
                  strokeDasharray="3 3"
                  label={{ value: "50%", fill: "#888", fontSize: 11 }}
                />
                {coachingIndices.map((c, i) => (
                  <ReferenceLine
                    key={i}
                    x={c.index}
                    stroke="#a855f7"
                    strokeDasharray="4 4"
                    label={{
                      value: c.coachName,
                      fill: "#a855f7",
                      fontSize: 10,
                      position: "top",
                    }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="winRate"
                  stroke="#22c55e"
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
        <Card>
          <CardHeader>
            <CardTitle>Matchup Win Rates</CardTitle>
            <CardDescription>Top 10 most-played matchups</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topMatchups} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    stroke="#888"
                    fontSize={12}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    stroke="#888"
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid #333",
                      borderRadius: "8px",
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, _: any, entry: any) => [
                      `${value}% (${entry.payload.wins}W ${entry.payload.losses}L / ${entry.payload.games} games)`,
                      "Win Rate",
                    ]}
                  />
                  <ReferenceLine x={50} stroke="#666" strokeDasharray="3 3" />
                  <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                    {topMatchups.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.winRate >= 50 ? "#22c55e" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Rune Comparison */}
        <Card>
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
                        {rune.name}
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
      <Card>
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

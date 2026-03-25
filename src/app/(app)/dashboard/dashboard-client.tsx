"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Snowflake,
  ChevronRight,
  AlertCircle,
  Calendar,
} from "lucide-react";
import type { Match, RankSnapshot, CoachingActionItem } from "@/db/schema";
import { getKeystoneIconUrlByName, getChampionIconUrl } from "@/lib/riot-api";
import { ChampionLink } from "@/components/champion-link";

interface DashboardMatch {
  id: string;
  gameDate: Date;
  result: "Victory" | "Defeat";
  championId: number;
  championName: string;
  runeKeystoneId: number | null;
  runeKeystoneName: string | null;
  matchupChampionId: number | null;
  matchupChampionName: string | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  csPerMin: number | null;
  gameDurationSeconds: number;
  goldEarned: number | null;
  visionScore: number | null;
  reviewed: boolean;
  comment: string | null;
  queueId: number | null;
}

interface MatchStats {
  total: number;
  wins: number;
  losses: number;
  unreviewed: number;
  postGamePending: number;
  vodPending: number;
}

interface UpcomingSession {
  id: number;
  coachName: string;
  date: Date;
  vodMatchId: string | null;
}

interface DashboardClientProps {
  user: {
    name?: string | null;
    riotGameName?: string | null;
    riotTagLine?: string | null;
    puuid?: string | null;
  };
  recentMatches: DashboardMatch[];
  matchStats: MatchStats;
  latestRank: RankSnapshot | null;
  recentSnapshots: RankSnapshot[];
  actionItems: CoachingActionItem[];
  upcomingSession: UpcomingSession | null;
  ddragonVersion: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getStreak(matches: DashboardMatch[]): { type: "W" | "L"; count: number } | null {
  if (matches.length === 0) return null;
  const first = matches[0].result;
  let count = 0;
  for (const m of matches) {
    if (m.result === first) count++;
    else break;
  }
  return { type: first === "Victory" ? "W" : "L", count };
}

function getRankDisplay(rank: RankSnapshot | null) {
  if (!rank || !rank.tier) return null;
  const tier = rank.tier.charAt(0) + rank.tier.slice(1).toLowerCase();
  return {
    tier,
    division: rank.division || "",
    lp: rank.lp || 0,
    wins: rank.wins || 0,
    losses: rank.losses || 0,
    display: `${tier} ${rank.division || ""}`.trim(),
  };
}

export function DashboardClient({
  user,
  recentMatches,
  matchStats,
  latestRank,
  recentSnapshots,
  actionItems,
  upcomingSession,
  ddragonVersion,
}: DashboardClientProps) {
  const isLinked = !!user.puuid;
  const streak = getStreak(recentMatches);
  const rankInfo = getRankDisplay(latestRank);

  // Session stats (last 10 games)
  const sessionWins = recentMatches.filter((m) => m.result === "Victory").length;
  const sessionLosses = recentMatches.filter((m) => m.result === "Defeat").length;
  const sessionWinRate =
    recentMatches.length > 0
      ? Math.round((sessionWins / recentMatches.length) * 100)
      : 0;

  // Overall stats from aggregates
  const totalWins = matchStats.wins;
  const totalLosses = matchStats.losses;
  const totalWinRate =
    matchStats.total > 0
      ? Math.round((totalWins / matchStats.total) * 100)
      : 0;

  // Average KDA from recent matches
  const avgKills =
    recentMatches.length > 0
      ? (recentMatches.reduce((s, m) => s + m.kills, 0) / recentMatches.length).toFixed(1)
      : "0";
  const avgDeaths =
    recentMatches.length > 0
      ? (recentMatches.reduce((s, m) => s + m.deaths, 0) / recentMatches.length).toFixed(1)
      : "0";
  const avgAssists =
    recentMatches.length > 0
      ? (recentMatches.reduce((s, m) => s + m.assists, 0) / recentMatches.length).toFixed(1)
      : "0";
  const avgCS =
    recentMatches.length > 0
      ? (recentMatches.reduce((s, m) => s + m.cs, 0) / recentMatches.length).toFixed(0)
      : "0";

  // Games needing review
  // LP trend: compare latest snapshot to oldest in the recent set
  const lpTrend = (() => {
    if (recentSnapshots.length < 2) return null;
    // recentSnapshots are ordered desc, so [0] is newest, [last] is oldest
    const newest = recentSnapshots[0];
    const oldest = recentSnapshots[recentSnapshots.length - 1];
    if (!newest.tier || !oldest.tier) return null;

    const TIER_ORDER = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
    const DIV_ORDER = ["IV", "III", "II", "I"];

    function toCumLP(tier: string, division: string | null, lp: number) {
      const tierIdx = TIER_ORDER.indexOf(tier.toUpperCase());
      if (tierIdx === -1) return 0;
      const isMaster = tierIdx >= TIER_ORDER.indexOf("MASTER");
      const divIdx = isMaster ? 0 : DIV_ORDER.indexOf(division || "IV");
      return tierIdx * 400 + (divIdx < 0 ? 0 : divIdx) * 100 + lp;
    }

    const newLP = toCumLP(newest.tier, newest.division, newest.lp || 0);
    const oldLP = toCumLP(oldest.tier, oldest.division, oldest.lp || 0);
    return newLP - oldLP;
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">Dashboard</h1>
          {user.riotGameName && (
            <p className="text-muted-foreground">
              {user.riotGameName}#{user.riotTagLine}
            </p>
          )}
        </div>
      </div>

      {!isLinked && (
        <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-gold-light">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Link your Riot account in{" "}
            <Link href="/settings" className="underline font-medium">
              Settings
            </Link>{" "}
            to get started.
          </span>
        </div>
      )}

      {/* Rank + Streak Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Rank Card */}
        <Card className="hover-lift surface-glow">
          <CardHeader className="pb-2">
            <CardDescription>Current Rank</CardDescription>
          </CardHeader>
          <CardContent>
            {rankInfo ? (
              <div>
                <p className="text-2xl font-bold text-gold">{rankInfo.display}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="text-gold/80">{rankInfo.lp} LP</span> &middot; {rankInfo.wins}W {rankInfo.losses}L
                </p>
                {lpTrend !== null && (
                  <p
                    className={`text-xs font-mono font-semibold mt-1 flex items-center gap-1 ${
                      lpTrend >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {lpTrend >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {lpTrend >= 0 ? "+" : ""}{lpTrend} LP recently
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No rank data yet. Update your games to see your rank.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Win Rate Card */}
        <Card className="hover-lift surface-glow">
          <CardHeader className="pb-2">
            <CardDescription>Session Win Rate (Last 10)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{sessionWinRate}%</p>
              {sessionWinRate >= 50 ? (
                <TrendingUp className="h-4 w-4 text-green-400" />
              ) : recentMatches.length > 0 ? (
                <TrendingDown className="h-4 w-4 text-red-400" />
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {sessionWins}W {sessionLosses}L
            </p>
            {recentMatches.length > 0 && (
              <Progress value={sessionWinRate} className="mt-2 h-2" />
            )}
          </CardContent>
        </Card>

        {/* Streak Card */}
        <Card className="hover-lift surface-glow">
          <CardHeader className="pb-2">
            <CardDescription>Current Streak</CardDescription>
          </CardHeader>
          <CardContent>
            {streak ? (
              <div className="flex items-center gap-2">
                {streak.type === "W" ? (
                  <Flame className="h-5 w-5 text-orange-500" />
                ) : (
                  <Snowflake className="h-5 w-5 text-blue-400" />
                )}
                <p className="text-2xl font-bold">
                  {streak.count}{streak.type}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No games yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Avg KDA Card */}
        <Card className="hover-lift surface-glow">
          <CardHeader className="pb-2">
            <CardDescription>Avg KDA (Last 10)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono text-gold">
              {avgKills}/{avgDeaths}/{avgAssists}
            </p>
            <p className="text-sm text-muted-foreground">
              Avg CS: {avgCS}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Games + Action Items */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Games */}
        <Card className="lg:col-span-2 surface-glow">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Games</CardTitle>
              <CardDescription>
                {matchStats.total} total &middot; {totalWins}W {totalLosses}L ({totalWinRate}%)
              </CardDescription>
            </div>
            <Link href="/matches">
              <Button variant="ghost" size="sm">
                View All
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No matches yet.
              </p>
            ) : (
              <div className="space-y-2">
                {recentMatches.slice(0, 10).map((match) => (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}`}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-surface-elevated transition-colors"
                  >
                    <div
                      className={`w-1 h-8 rounded-full ${
                        match.result === "Victory"
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    />
                    <Image
                      src={getChampionIconUrl(ddragonVersion, match.championName)}
                      alt={match.championName}
                      width={32}
                      height={32}
                      className="rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {match.championName}
                        </span>
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          vs
                          {match.matchupChampionName ? (
                            <ChampionLink
                              champion={match.matchupChampionName}
                              ddragonVersion={ddragonVersion}
                              linkTo="scout-enemy"
                              yourChampion={match.championName}
                              iconSize={16}
                              textClassName="text-xs text-muted-foreground"
                              stopPropagation
                            />
                          ) : "?"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        {match.runeKeystoneName && (() => {
                          const iconUrl = getKeystoneIconUrlByName(match.runeKeystoneName);
                          return iconUrl ? (
                            <Image src={iconUrl} alt="" width={12} height={12} className="rounded-sm" />
                          ) : null;
                        })()}
                        {match.runeKeystoneName || "—"} &middot;{" "}
                        {formatDuration(match.gameDurationSeconds)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-mono">
                        {match.kills}/{match.deaths}/{match.assists}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        {match.cs} CS
                      </div>
                    </div>
                    <Badge
                      variant={
                        match.result === "Victory" ? "default" : "destructive"
                      }
                      className="text-xs w-6 justify-center"
                    >
                      {match.result === "Victory" ? "W" : "L"}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Upcoming Coaching Session */}
          {upcomingSession && (
            <Card className="surface-glow border-gold/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gold" />
                  Next Session
                </CardTitle>
                <Link href={`/coaching/${upcomingSession.id}`}>
                  <Button variant="ghost" size="sm">
                    View
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">{upcomingSession.coachName}</p>
                <p className="text-sm text-muted-foreground">
                  {new Intl.DateTimeFormat("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(upcomingSession.date)}
                </p>
                {!upcomingSession.vodMatchId && (
                  <p className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    No VOD selected yet
                  </p>
                )}
                {(() => {
                  const now = new Date();
                  const diff = upcomingSession.date.getTime() - now.getTime();
                  if (diff <= 0) {
                    return (
                      <Badge className="mt-2 text-xs bg-gold/20 text-gold border-gold/30">
                        Ready to complete
                      </Badge>
                    );
                  }
                  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const timeStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
                  return (
                    <p className="text-xs text-muted-foreground mt-1">
                      In {timeStr}
                    </p>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Action Items Card */}
          <Card className="surface-glow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Action Items</CardTitle>
              <Link href="/coaching/action-items">
                <Button variant="ghost" size="sm">
                  View All
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active action items.
                </p>
              ) : (
                <div className="space-y-2">
                  {actionItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2 text-sm"
                    >
                      <div
                        className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                          item.status === "in_progress"
                            ? "bg-gold"
                            : "bg-muted-foreground"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{item.description}</p>
                        {item.topic && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {item.topic}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

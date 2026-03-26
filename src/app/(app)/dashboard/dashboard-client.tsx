"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResultBadge, ResultBar } from "@/components/result-badge";
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
  Target,
} from "lucide-react";
import type { RankSnapshot, CoachingActionItem, Goal, MatchResult } from "@/db/schema";
import { getKeystoneIconUrlByName, getChampionIconUrl } from "@/lib/riot-api";
import { ChampionLink } from "@/components/champion-link";
import { formatDuration, formatDate, DEFAULT_LOCALE } from "@/lib/format";
import {
  formatTierDivision,
  calculateProgress,
} from "@/lib/rank";

interface DashboardMatch {
  id: string;
  gameDate: Date;
  result: MatchResult;
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
  lpTrend: number | null;
  actionItems: CoachingActionItem[];
  upcomingSession: UpcomingSession | null;
  activeGoal: Goal | null;
  currentRank: { tier: string; division: string | null; lp: number } | null;
  ddragonVersion: string;
}

function getStreak(matches: DashboardMatch[]): { type: "W" | "L"; count: number } | null {
  if (matches.length === 0) return null;
  // Skip remakes — they don't affect streaks
  const meaningful = matches.filter((m) => m.result !== "Remake");
  if (meaningful.length === 0) return null;
  const first = meaningful[0].result;
  let count = 0;
  for (const m of meaningful) {
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
  lpTrend,
  actionItems,
  upcomingSession,
  activeGoal,
  currentRank,
  ddragonVersion,
}: DashboardClientProps) {
  const t = useTranslations("Dashboard");
  const { data: session } = useSession();
  const locale = session?.user?.locale ?? DEFAULT_LOCALE;
  const isLinked = !!user.puuid;
  const streak = getStreak(recentMatches);
  const rankInfo = getRankDisplay(latestRank);

  // Session stats (last 10 games, excluding remakes)
  const sessionGames = recentMatches.filter((m) => m.result !== "Remake");
  const sessionWins = sessionGames.filter((m) => m.result === "Victory").length;
  const sessionLosses = sessionGames.filter((m) => m.result === "Defeat").length;
  const sessionWinRate =
    sessionGames.length > 0
      ? Math.round((sessionWins / sessionGames.length) * 100)
      : 0;

  // Overall stats from aggregates
  const totalWins = matchStats.wins;
  const totalLosses = matchStats.losses;
  const totalWinRate =
    matchStats.total > 0
      ? Math.round((totalWins / matchStats.total) * 100)
      : 0;

  // Average KDA from recent matches (excluding remakes)
  const meaningfulRecent = recentMatches.filter((m) => m.result !== "Remake");
  const avgKills =
    meaningfulRecent.length > 0
      ? (meaningfulRecent.reduce((s, m) => s + m.kills, 0) / meaningfulRecent.length).toFixed(1)
      : "0";
  const avgDeaths =
    meaningfulRecent.length > 0
      ? (meaningfulRecent.reduce((s, m) => s + m.deaths, 0) / meaningfulRecent.length).toFixed(1)
      : "0";
  const avgAssists =
    meaningfulRecent.length > 0
      ? (meaningfulRecent.reduce((s, m) => s + m.assists, 0) / meaningfulRecent.length).toFixed(1)
      : "0";
  const avgCS =
    meaningfulRecent.length > 0
      ? (meaningfulRecent.reduce((s, m) => s + m.cs, 0) / meaningfulRecent.length).toFixed(0)
      : "0";

  // Games needing review

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">{t("heading")}</h1>
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
            {t.rich("linkRiotAccount", {
              link: (chunks) => (
                <Link href="/settings" className="underline font-medium">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </div>
      )}

      {/* Rank + Streak Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Rank Card */}
        <Card className="hover-lift surface-glow">
          <CardHeader className="pb-2">
            <CardDescription>{t("currentRank")}</CardDescription>
          </CardHeader>
          <CardContent>
            {rankInfo ? (
              <div>
                <p className="text-2xl font-bold text-gold">{rankInfo.display}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="text-gold/80">{t("lpLabel", { lp: rankInfo.lp })}</span> &middot; {rankInfo.wins}W {rankInfo.losses}L
                </p>
                {lpTrend !== null && (
                  <p
                    className={`text-xs font-mono font-semibold mt-1 flex items-center gap-1 ${
                      lpTrend >= 0 ? "text-win" : "text-loss"
                    }`}
                  >
                    {lpTrend >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {lpTrend >= 0 ? "+" : ""}{t("lpTrendRecently", { lpChange: lpTrend })}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t("noRankData")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Win Rate Card */}
        <Card className="hover-lift surface-glow">
          <CardHeader className="pb-2">
            <CardDescription>{t("sessionWinRate")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{sessionWinRate}%</p>
              {sessionWinRate >= 50 ? (
                <TrendingUp className="h-4 w-4 text-win" />
              ) : recentMatches.length > 0 ? (
                <TrendingDown className="h-4 w-4 text-loss" />
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
            <CardDescription>{t("currentStreak")}</CardDescription>
          </CardHeader>
          <CardContent>
            {streak ? (
              <div className="flex items-center gap-2">
                {streak.type === "W" ? (
                  <Flame className="h-5 w-5 text-streak-hot" />
                ) : (
                  <Snowflake className="h-5 w-5 text-streak-cold" />
                )}
                <p className="text-2xl font-bold">
                  {streak.count}{streak.type}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t("noGamesYet")}</p>
            )}
          </CardContent>
        </Card>

        {/* Avg KDA Card */}
        <Card className="hover-lift surface-glow">
          <CardHeader className="pb-2">
            <CardDescription>{t("avgKdaLast10")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono text-gold">
              {avgKills}/{avgDeaths}/{avgAssists}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("avgCs", { avgCS })}
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
              <CardTitle>{t("recentGames")}</CardTitle>
              <CardDescription>
                {t("recentGamesDescription", { total: matchStats.total, wins: totalWins, losses: totalLosses, winRate: totalWinRate })}
              </CardDescription>
            </div>
            <Link href="/matches">
              <Button variant="ghost" size="sm">
                {t("viewAll")}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("noMatchesYet")}
              </p>
            ) : (
              <div className="space-y-2">
                {recentMatches.slice(0, 10).map((match) => (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}`}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-surface-elevated transition-colors"
                  >
                    <ResultBar result={match.result} />
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
                          {t("vs")}
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
                        {t("csLabel", { cs: match.cs })}
                      </div>
                    </div>
                    <ResultBadge result={match.result} className="w-6 justify-center" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Upcoming Coaching Session */}
          {upcomingSession ? (
            <Card className="surface-glow border-gold/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gold" />
                  {t("nextSession")}
                </CardTitle>
                <Link href={`/coaching/${upcomingSession.id}`}>
                  <Button variant="ghost" size="sm">
                    {t("view")}
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">{upcomingSession.coachName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(upcomingSession.date, locale, "datetime-short")}
                </p>
                {!upcomingSession.vodMatchId && (
                  <p className="text-xs text-warning flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {t("noVodSelected")}
                  </p>
                )}
                {(() => {
                  const now = new Date();
                  const diff = upcomingSession.date.getTime() - now.getTime();
                  if (diff <= 0) {
                    return (
                      <Badge className="mt-2 text-xs bg-gold/20 text-gold border-gold/30">
                        {t("readyToComplete")}
                      </Badge>
                    );
                  }
                  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const timeStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
                  return (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("sessionIn", { timeStr })}
                    </p>
                  );
                })()}
              </CardContent>
            </Card>
          ) : (
            <Card className="surface-glow border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {t("nextSession")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t("noCoachingSessions")}</p>
                <Link href="/coaching/new" className="inline-block mt-2">
                  <Button variant="outline" size="sm">{t("scheduleOne")}</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Goal Widget */}
          {activeGoal && currentRank ? (() => {
            const progress = calculateProgress(
              activeGoal.startTier,
              activeGoal.startDivision,
              activeGoal.startLp,
              currentRank.tier,
              currentRank.division,
              currentRank.lp,
              activeGoal.targetTier,
              activeGoal.targetDivision
            );
            return (
              <Card className="surface-glow border-gold/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-gold" />
                    {activeGoal.title}
                  </CardTitle>
                  <Link href="/goals">
                    <Button variant="ghost" size="sm">
                      {t("view")}
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Progress value={progress}>
                    <span className="text-xs text-muted-foreground">
                      {formatTierDivision(currentRank.tier, currentRank.division)}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {progress}%
                    </span>
                  </Progress>
                </CardContent>
              </Card>
            );
          })() : (
            <Card className="surface-glow border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  {t("goalWidget")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t("noActiveGoal")}</p>
                <Link href="/goals/new" className="inline-block mt-2">
                  <Button variant="outline" size="sm">{t("setGoal")}</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Action Items Card */}
          <Card className="surface-glow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{t("actionItems")}</CardTitle>
              <Link href="/coaching/action-items">
                <Button variant="ghost" size="sm">
                  {t("viewAll")}
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("noActiveActionItems")}
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

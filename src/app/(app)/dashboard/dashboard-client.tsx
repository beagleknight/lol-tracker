"use client";

import {
  TrendingUp,
  TrendingDown,
  Flame,
  Snowflake,
  ChevronRight,
  AlertCircle,
  Calendar,
  Target,
  GraduationCap,
  Crosshair,
  Globe,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";

import type { RankSnapshot, CoachingActionItem, Goal, MatchResult } from "@/db/schema";

import { MatchCard, type MatchHighlightData } from "@/components/match-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth-client";
import { formatDate, DEFAULT_LOCALE } from "@/lib/format";
import { formatTierDivision, calculateProgress, getRankMilestones } from "@/lib/rank";
import { getRankEmblemUrl } from "@/lib/rank-utils";

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
  reviewNotes: string | null;
  reviewSkippedReason: string | null;
  comment: string | null;
  duoPartnerPuuid: string | null;
  queueId: number | null;
  position: string | null;
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

interface LastCompletedSession {
  id: number;
  coachName: string;
  date: Date;
}

interface DashboardClientProps {
  user: {
    name?: string | null;
    riotGameName?: string | null;
    riotTagLine?: string | null;
    puuid?: string | null;
  };
  recentMatches: DashboardMatch[];
  highlightsPerMatch: Record<string, MatchHighlightData[]>;
  matchStats: MatchStats;
  latestRank: RankSnapshot | null;
  lpTrend: number | null;
  lpTrendDays: number | null;
  actionItems: CoachingActionItem[];
  upcomingSession: UpcomingSession | null;
  activeGoal: Goal | null;
  lastCompletedSession: LastCompletedSession | null;
  daysSinceLastCoaching: number | null;
  currentRank: { tier: string; division: string | null; lp: number } | null;
  ddragonVersion: string;
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
    rawTier: rank.tier,
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
  highlightsPerMatch,
  matchStats,
  latestRank,
  lpTrend,
  lpTrendDays,
  actionItems,
  upcomingSession,
  activeGoal,
  lastCompletedSession,
  daysSinceLastCoaching,
  currentRank,
  ddragonVersion,
}: DashboardClientProps) {
  const t = useTranslations("Dashboard");
  const { user: authUser } = useAuth();
  const locale = authUser?.locale ?? DEFAULT_LOCALE;
  const isLinked = !!user.puuid;
  const streak = getStreak(recentMatches);
  const rankInfo = getRankDisplay(latestRank);

  // Coaching cadence
  const coachingCadence: "good" | "warning" | "overdue" | null =
    daysSinceLastCoaching !== null
      ? daysSinceLastCoaching < 14
        ? "good"
        : daysSinceLastCoaching <= 21
          ? "warning"
          : "overdue"
      : null;

  // Session stats (last 10 games — remakes already excluded by query)
  const sessionWins = recentMatches.filter((m) => m.result === "Victory").length;
  const sessionLosses = recentMatches.filter((m) => m.result === "Defeat").length;
  const sessionWinRate =
    recentMatches.length > 0 ? Math.round((sessionWins / recentMatches.length) * 100) : 0;

  // Overall stats from aggregates
  const totalWins = matchStats.wins;
  const totalLosses = matchStats.losses;
  const totalWinRate = matchStats.total > 0 ? Math.round((totalWins / matchStats.total) * 100) : 0;

  // Average KDA from recent matches (remakes already excluded by query)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-in-up flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("heading")}</h1>
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
                <Link href="/settings" className="font-medium underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </div>
      )}

      {isLinked && !authUser?.primaryRole && (
        <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-gold-light">
          <Crosshair className="h-4 w-4 shrink-0" />
          <span>
            {t.rich("setRolePreferences", {
              link: (chunks) => (
                <Link href="/settings" className="font-medium underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </div>
      )}

      {isLinked && !authUser?.region && (
        <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-gold-light">
          <Globe className="h-4 w-4 shrink-0" />
          <span>
            {t.rich("selectRegion", {
              link: (chunks) => (
                <Link href="/settings" className="font-medium underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </div>
      )}

      {/* Rank + Streak Row */}
      <div className="animate-in-up-delay-1 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Rank Card */}
        <Card className="surface-glow overflow-hidden border-gold/30">
          <CardHeader className="pb-2">
            <CardDescription>{t("currentRank")}</CardDescription>
          </CardHeader>
          <CardContent>
            {rankInfo ? (
              <div className="flex items-center gap-3">
                <Image
                  src={getRankEmblemUrl(rankInfo.rawTier)}
                  alt={rankInfo.display}
                  width={48}
                  height={48}
                  className="shrink-0 drop-shadow-md"
                />
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-gold">{rankInfo.display}</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-mono text-gold/80">
                      {t("lpLabel", { lp: rankInfo.lp })}
                    </span>{" "}
                    &middot;{" "}
                    <span className="font-mono">
                      {rankInfo.wins}W {rankInfo.losses}L
                    </span>
                  </p>
                  {lpTrend !== null && (
                    <p
                      className={`mt-1 flex items-center gap-1 font-mono text-xs font-semibold ${
                        lpTrend >= 0 ? "text-win" : "text-loss"
                      }`}
                    >
                      {lpTrend >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {lpTrend >= 0 ? "+" : ""}
                      {lpTrendDays !== null
                        ? t("lpTrendInDays", { lpChange: lpTrend, days: lpTrendDays })
                        : t("lpTrendRecently", { lpChange: lpTrend })}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noRankData")}</p>
            )}
          </CardContent>
        </Card>

        {/* Win Rate Card */}
        <Card className="surface-glow">
          <CardHeader className="pb-2">
            <CardDescription>{t("sessionWinRate")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="font-mono text-2xl font-bold">{sessionWinRate}%</p>
              {sessionWinRate >= 50 ? (
                <TrendingUp className="h-4 w-4 text-win" />
              ) : recentMatches.length > 0 ? (
                <TrendingDown className="h-4 w-4 text-loss" />
              ) : null}
            </div>
            <p className="font-mono text-sm text-muted-foreground">
              {sessionWins}W {sessionLosses}L
            </p>
            {recentMatches.length > 0 && (
              <Progress
                value={sessionWinRate}
                className="mt-2 h-2"
                aria-label={`Win rate: ${sessionWinRate}%`}
              />
            )}
          </CardContent>
        </Card>

        {/* Streak Card */}
        <Card className="surface-glow">
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
                <p className="font-mono text-2xl font-bold">
                  {streak.count}
                  {streak.type}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noGamesYet")}</p>
            )}
          </CardContent>
        </Card>

        {/* Avg KDA Card */}
        <Card className="surface-glow">
          <CardHeader className="pb-2">
            <CardDescription>{t("avgKdaLast10")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold text-gold">
              {avgKills}/{avgDeaths}/{avgAssists}
            </p>
            <p className="font-mono text-sm text-muted-foreground">{t("avgCs", { avgCS })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Games + Action Items */}
      <div className="animate-in-up-delay-2 grid gap-6 lg:grid-cols-3">
        {/* Recent Games */}
        <Card className="surface-glow lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("recentGames")}</CardTitle>
              <CardDescription>
                {t("recentGamesDescription", {
                  total: matchStats.total,
                  wins: totalWins,
                  losses: totalLosses,
                  winRate: totalWinRate,
                })}
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
              <p className="py-4 text-center text-sm text-muted-foreground">{t("noMatchesYet")}</p>
            ) : (
              <div className="space-y-3">
                {recentMatches.slice(0, 10).map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    ddragonVersion={ddragonVersion}
                    matchHighlights={highlightsPerMatch[match.id] || []}
                    variant="compact"
                    showScoutLink
                    userPrimaryRole={authUser?.primaryRole}
                    userSecondaryRole={authUser?.secondaryRole}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Coaching Widget — unified card adapting to session state */}
          {(() => {
            const cadenceColors = {
              good: "text-win",
              warning: "text-warning",
              overdue: "text-loss",
            };
            const badgeClasses = {
              good: "bg-win/20 text-win border-win/30",
              warning: "bg-warning/20 text-warning border-warning/30",
              overdue: "bg-loss/10 text-loss border-loss/30",
            };

            // State 1: Has upcoming session
            if (upcomingSession) {
              return (
                <Card className="surface-glow border-gold/20">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calendar className="h-4 w-4 text-gold" />
                      {t("coachingWidget")}
                    </CardTitle>
                    <Link href={`/coaching/${upcomingSession.id}`}>
                      <Button variant="ghost" size="sm">
                        {t("view")}
                        <ChevronRight className="ml-1 h-3 w-3" />
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">{upcomingSession.coachName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(upcomingSession.date, locale, "datetime-short")}
                      </p>
                      {!upcomingSession.vodMatchId && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-warning">
                          <AlertCircle className="h-3 w-3" />
                          {t("noVodSelected")}
                        </p>
                      )}
                      {(() => {
                        const now = new Date();
                        const diff = upcomingSession.date.getTime() - now.getTime();
                        if (diff <= 0) {
                          const daysOverdue = Math.floor(-diff / (1000 * 60 * 60 * 24));
                          const isOverdue = daysOverdue >= 2;
                          return (
                            <Badge
                              className={`mt-2 text-xs ${
                                isOverdue
                                  ? "border-loss/30 bg-loss/10 text-loss"
                                  : "border-gold/30 bg-gold/20 text-gold"
                              }`}
                            >
                              {isOverdue
                                ? t("readyToCompleteDaysAgo", { days: daysOverdue })
                                : t("readyToComplete")}
                            </Badge>
                          );
                        }
                        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const timeStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
                        return (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("sessionIn", { timeStr })}
                          </p>
                        );
                      })()}
                    </div>
                    {lastCompletedSession && coachingCadence && daysSinceLastCoaching !== null && (
                      <div className="flex items-center gap-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                        <GraduationCap
                          className={`h-3.5 w-3.5 ${cadenceColors[coachingCadence]}`}
                        />
                        <span>
                          {t("lastSessionLabel")}{" "}
                          {daysSinceLastCoaching === 0
                            ? t("today").toLowerCase()
                            : t("daysAgo", { days: daysSinceLastCoaching })}
                        </span>
                        <Badge className={`ml-auto text-[10px] ${badgeClasses[coachingCadence]}`}>
                          {t(`cadence.${coachingCadence}`)}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            }

            // State 2: No upcoming session + has completed session
            if (lastCompletedSession && coachingCadence && daysSinceLastCoaching !== null) {
              const borderColors = {
                good: "border-win/20",
                warning: "border-warning/20",
                overdue: "border-loss/20",
              };
              return (
                <Card className={`surface-glow ${borderColors[coachingCadence]}`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <GraduationCap className={`h-4 w-4 ${cadenceColors[coachingCadence]}`} />
                      {t("coachingWidget")}
                    </CardTitle>
                    <Link href={`/coaching/${lastCompletedSession.id}`}>
                      <Button variant="ghost" size="sm">
                        {t("view")}
                        <ChevronRight className="ml-1 h-3 w-3" />
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <p className={`font-mono text-lg font-bold ${cadenceColors[coachingCadence]}`}>
                      {daysSinceLastCoaching === 0
                        ? t("today")
                        : t("daysAgo", { days: daysSinceLastCoaching })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {lastCompletedSession.coachName}
                    </p>
                    <Badge className={`mt-2 text-xs ${badgeClasses[coachingCadence]}`}>
                      {t(`cadence.${coachingCadence}`)}
                    </Badge>
                    <Link href="/coaching/new" className="mt-3 block">
                      <Button variant="outline" size="sm" className="w-full">
                        {t("scheduleNext")}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            }

            // State 3: No sessions at all
            return (
              <Card className="surface-glow border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    {t("coachingWidget")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{t("noCoachingSessions")}</p>
                  <Link href="/coaching/new" className="mt-2 inline-block">
                    <Button variant="outline" size="sm">
                      {t("scheduleOne")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })()}

          {/* Goal Widget */}
          {activeGoal && currentRank ? (
            (() => {
              const progress = calculateProgress(
                activeGoal.startTier,
                activeGoal.startDivision,
                activeGoal.startLp,
                currentRank.tier,
                currentRank.division,
                currentRank.lp,
                activeGoal.targetTier,
                activeGoal.targetDivision,
              );
              const milestones = getRankMilestones(
                activeGoal.startTier,
                activeGoal.startDivision,
                activeGoal.startLp,
                activeGoal.targetTier,
                activeGoal.targetDivision,
              );
              return (
                <Card className="surface-glow border-gold/20">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
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
                    <Progress value={progress} aria-label={`Goal progress: ${progress}%`}>
                      <span className="text-xs text-muted-foreground">
                        {formatTierDivision(currentRank.tier, currentRank.division)}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {formatTierDivision(activeGoal.targetTier, activeGoal.targetDivision)} ·{" "}
                        {progress}%
                      </span>
                    </Progress>
                    {milestones.length > 0 && (
                      <div className="relative h-2">
                        {milestones.map((m) => (
                          <div
                            key={m.label}
                            className="absolute top-0 flex flex-col items-center"
                            style={{ left: `${m.percent}%` }}
                            title={m.label}
                          >
                            <div className="h-2 w-px bg-muted-foreground/40" />
                            <span className="mt-0.5 text-[10px] leading-none text-muted-foreground/60">
                              {m.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()
          ) : (
            <Card className="surface-glow border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  {t("goalWidget")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t("noActiveGoal")}</p>
                <Link href="/goals/new" className="mt-2 inline-block">
                  <Button variant="outline" size="sm">
                    {t("setGoal")}
                  </Button>
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
                <p className="text-sm text-muted-foreground">{t("noActiveActionItems")}</p>
              ) : (
                <div className="space-y-2">
                  {actionItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 text-sm">
                      <div
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          item.status === "in_progress" ? "bg-gold" : "bg-muted-foreground"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{item.description}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              item.status === "in_progress"
                                ? "border-gold/30 bg-gold/10 text-gold"
                                : ""
                            }`}
                          >
                            {item.status === "in_progress"
                              ? t("actionItemInProgress")
                              : t("actionItemPending")}
                          </Badge>
                          {item.topic && (
                            <Badge variant="secondary" className="text-xs">
                              {item.topic}
                            </Badge>
                          )}
                        </div>
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

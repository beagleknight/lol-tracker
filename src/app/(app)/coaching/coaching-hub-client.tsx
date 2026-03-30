"use client";

import {
  Plus,
  GraduationCap,
  ChevronRight,
  CalendarCheck,
  Clock,
  CheckCircle2,
  Circle,
  Play,
  Loader2,
  ListChecks,
  TrendingUp,
  Swords,
  AlertTriangle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import type { CoachingSession, CoachingActionItem } from "@/db/schema";

import { updateActionItemStatus } from "@/app/actions/coaching";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-client";
import { formatDate, DEFAULT_LOCALE } from "@/lib/format";
import { getChampionIconUrl } from "@/lib/riot-api";

interface VodMatchInfo {
  id: string;
  championName: string;
  matchupChampionName: string | null;
  result: string;
}

interface IntervalData {
  matchCount: number;
  wins: number;
  losses: number;
  relevantNoteCount: number;
}

interface CoachingHubClientProps {
  scheduledSessions: CoachingSession[];
  completedSessions: CoachingSession[];
  activeActionItems: CoachingActionItem[];
  actionItemsBySession: Record<number, { total: number; completed: number }>;
  vodMatchMap: Record<string, VodMatchInfo>;
  intervalsData: Record<number, IntervalData>;
  ddragonVersion: string;
}

function ActionItemMiniRow({ item }: { item: CoachingActionItem }) {
  const t = useTranslations("Coaching");
  const [isPending, startTransition] = useTransition();

  function cycleStatus() {
    const nextStatus: Record<string, "pending" | "in_progress" | "completed"> = {
      pending: "in_progress",
      in_progress: "completed",
      completed: "pending",
    };
    const next = nextStatus[item.status];
    startTransition(async () => {
      try {
        await updateActionItemStatus(item.id, next);
      } catch {
        toast.error(t("toasts.updateActionItemError"));
      }
    });
  }

  const icons = {
    pending: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
    in_progress: <Play className="h-3.5 w-3.5 text-status-progress" />,
    completed: <CheckCircle2 className="h-3.5 w-3.5 text-win" />,
  };

  return (
    <div className="flex items-center gap-2 py-1.5">
      <button
        onClick={cycleStatus}
        disabled={isPending}
        className="shrink-0 cursor-pointer"
        aria-label="Toggle action item status"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icons[item.status]}
      </button>
      <span className="flex-1 truncate text-sm">{item.description}</span>
      {item.topic && (
        <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
          {item.topic}
        </Badge>
      )}
    </div>
  );
}

export function CoachingHubClient({
  scheduledSessions,
  completedSessions,
  activeActionItems,
  actionItemsBySession,
  vodMatchMap,
  intervalsData,
  ddragonVersion,
}: CoachingHubClientProps) {
  const { user } = useAuth();
  const locale = user?.locale ?? DEFAULT_LOCALE;
  const t = useTranslations("Coaching");
  const totalSessions = scheduledSessions.length + completedSessions.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {totalSessions === 0
              ? t("subtitleEmpty")
              : t("subtitleSummary", { totalSessions, activeCount: activeActionItems.length })}
          </p>
        </div>
        <Link href="/coaching/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("scheduleSessionButton")}
          </Button>
        </Link>
      </div>

      {/* Empty state */}
      {totalSessions === 0 && activeActionItems.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <GraduationCap className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-lg font-medium">{t("emptyStateTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyStateDescription")}</p>
          <Link href="/coaching/new" className="mt-4">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("scheduleSessionButton")}
            </Button>
          </Link>
        </div>
      )}

      {/* Upcoming Sessions */}
      {scheduledSessions.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-gold" />
            <h2 className="text-lg font-semibold">{t("upcomingSessions")}</h2>
          </div>
          <div className="space-y-3">
            {scheduledSessions.map((session) => {
              const dateStr = formatDate(session.date, locale, "datetime-short");
              const vodMatch = session.vodMatchId ? vodMatchMap[session.vodMatchId] : null;
              const topics: string[] = session.topics ? JSON.parse(session.topics) : [];

              return (
                <Link key={session.id} href={`/coaching/${session.id}`}>
                  <Card className="hover-lift cursor-pointer border-gold/20 bg-gold/5 transition-colors hover:bg-gold/10">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GraduationCap className="h-5 w-5 shrink-0 text-gold" />
                          <div>
                            <CardTitle className="text-base">{session.coachName}</CardTitle>
                            <CardDescription>{dateStr}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!session.vodMatchId && (
                            <Badge
                              variant="outline"
                              className="border-warning/40 px-1.5 py-0 text-[10px] text-warning"
                            >
                              <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />
                              {t("badgeNoVod")}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {t("badgeScheduled")}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-3">
                        {vodMatch && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Image
                              src={getChampionIconUrl(ddragonVersion, vodMatch.championName)}
                              alt={vodMatch.championName}
                              width={16}
                              height={16}
                              className="rounded"
                            />
                            {vodMatch.championName}
                            {vodMatch.matchupChampionName && (
                              <>
                                {" "}
                                {t("vs")}{" "}
                                <Image
                                  src={getChampionIconUrl(
                                    ddragonVersion,
                                    vodMatch.matchupChampionName,
                                  )}
                                  alt={vodMatch.matchupChampionName}
                                  width={16}
                                  height={16}
                                  className="rounded"
                                />
                                {vodMatch.matchupChampionName}
                              </>
                            )}
                          </div>
                        )}
                        {topics.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {topics.map((topic) => (
                              <Badge
                                key={topic}
                                variant="outline"
                                className="px-1.5 py-0 text-[10px]"
                              >
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Active Action Items */}
      {activeActionItems.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-gold" />
              <h2 className="text-lg font-semibold">{t("activeActionItems")}</h2>
              <Badge variant="secondary" className="text-xs">
                {activeActionItems.length}
              </Badge>
            </div>
            <Link href="/coaching/action-items">
              <Button variant="ghost" size="sm" className="text-xs">
                {t("viewAll")}
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          <Card className="surface-glow">
            <CardContent className="divide-y divide-border/50 pt-4">
              {activeActionItems.slice(0, 8).map((item) => (
                <ActionItemMiniRow key={item.id} item={item} />
              ))}
              {activeActionItems.length > 8 && (
                <p className="pt-2 text-xs text-muted-foreground">
                  {t("moreItems", { count: activeActionItems.length - 8 })}
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Past Sessions Timeline */}
      {completedSessions.length > 0 && (
        <section>
          <Separator className="my-2" />
          <div className="mt-4 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t("pastSessions")}</h2>
          </div>
          <div className="space-y-2">
            {completedSessions.map((session) => {
              const topics: string[] = session.topics ? JSON.parse(session.topics) : [];
              const items = actionItemsBySession[session.id];
              const interval = intervalsData[session.id];
              const dateStr = formatDate(session.date, locale, "short");

              return (
                <div key={session.id} className="space-y-2">
                  {/* Session Card */}
                  <Link href={`/coaching/${session.id}`}>
                    <Card className="hover-lift cursor-pointer transition-colors hover:bg-surface-elevated">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <GraduationCap className="h-5 w-5 shrink-0 text-gold" />
                            <div>
                              <CardTitle className="text-base">{session.coachName}</CardTitle>
                              <CardDescription>
                                {dateStr}
                                {session.durationMinutes &&
                                  ` · ${t("durationMinutes", { minutes: session.durationMinutes })}`}
                              </CardDescription>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-1.5">
                          {topics.map((topic) => (
                            <Badge key={topic} variant="secondary" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                        {items && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t("actionItemsCompleted", {
                              completed: items.completed,
                              total: items.total,
                            })}
                          </p>
                        )}
                        {/* Nudges for incomplete session data */}
                        {(topics.length === 0 || !items || items.total === 0) && (
                          <p className="mt-2 flex items-center gap-1 text-xs text-warning">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {topics.length === 0 && (!items || items.total === 0)
                              ? t("missingFocusAreasAndActionItems")
                              : topics.length === 0
                                ? t("missingFocusAreas")
                                : t("missingActionItems")}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>

                  {/* Between-sessions interval */}
                  {interval && interval.matchCount > 0 && (
                    <div className="ml-6 flex items-center gap-3 py-1 text-xs text-muted-foreground">
                      <div className="h-4 w-0.5 bg-border" />
                      <Swords className="h-3 w-3 shrink-0" />
                      <span>{t("intervalGames", { count: interval.matchCount })}</span>
                      <span className="font-mono">
                        <span className="text-win">{interval.wins}W</span>{" "}
                        <span className="text-loss">{interval.losses}L</span>
                      </span>
                      {interval.matchCount > 0 && (
                        <span>
                          {t("intervalWinRate", {
                            winRate: Math.round((interval.wins / interval.matchCount) * 100),
                          })}
                        </span>
                      )}
                      {interval.relevantNoteCount > 0 && (
                        <Badge
                          variant="outline"
                          className="border-gold/30 px-1.5 py-0 text-[10px] text-gold"
                        >
                          <TrendingUp className="mr-0.5 h-2.5 w-2.5" />
                          {t("intervalRelatedNotes", { count: interval.relevantNoteCount })}
                        </Badge>
                      )}
                    </div>
                  )}
                  {interval && interval.matchCount === 0 && (
                    <div className="ml-6 flex items-center gap-3 py-1 text-xs text-muted-foreground">
                      <div className="h-4 w-0.5 bg-border" />
                      <span className="italic">{t("noGamesPlayed")}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

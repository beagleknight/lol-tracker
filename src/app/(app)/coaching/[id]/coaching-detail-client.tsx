"use client";

import {
  ArrowLeft,
  Loader2,
  GraduationCap,
  Trash2,
  Clock,
  CheckCircle2,
  Circle,
  Play,
  Video,
  ExternalLink,
  CalendarCheck,
  TrendingUp,
  Swords,
  Pencil,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { toast } from "sonner";

import type { CoachingSession, CoachingActionItem } from "@/db/schema";

import { updateActionItemStatus, deleteCoachingSession } from "@/app/actions/coaching";
import { HighlightsDisplay, type HighlightItem } from "@/components/highlights-editor";
import { ResultBadge, ResultBar } from "@/components/result-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-client";
import { formatDate, formatDuration, DEFAULT_LOCALE } from "@/lib/format";
import { getChampionIconUrl } from "@/lib/riot-api";

interface LinkedMatch {
  id: string;
  gameDate: Date;
  result: string;
  championName: string;
  matchupChampionName: string | null;
  kills: number;
  deaths: number;
  assists: number;
  runeKeystoneName: string | null;
  gameDurationSeconds: number;
  vodUrl: string | null;
}

interface ProgressMatch {
  id: string;
  gameDate: Date;
  result: string;
  championName: string;
  matchupChampionName: string | null;
  kills: number;
  deaths: number;
  assists: number;
  gameDurationSeconds: number;
}

interface CoachingDetailClientProps {
  session: CoachingSession;
  linkedMatches: LinkedMatch[];
  actionItems: CoachingActionItem[];
  ddragonVersion: string;
  highlightsByMatch: Record<
    string,
    Array<{
      type: "highlight" | "lowlight";
      text: string;
      topic: string | null;
    }>
  >;
  progressMatches: ProgressMatch[];
  progressHighlightsByMatch: Record<
    string,
    Array<{
      type: "highlight" | "lowlight";
      text: string;
      topic: string | null;
    }>
  >;
}

function ActionItemRow({ item }: { item: CoachingActionItem }) {
  const t = useTranslations("CoachingDetail");
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
        toast.success(t("toasts.statusUpdated", { status: next.replace("_", " ") }));
      } catch {
        toast.error(t("toasts.statusUpdateError"));
      }
    });
  }

  const icons = {
    pending: <Circle className="h-4 w-4 text-muted-foreground" />,
    in_progress: <Play className="h-4 w-4 text-status-progress" />,
    completed: <CheckCircle2 className="h-4 w-4 text-win" />,
  };

  return (
    <div
      data-testid="action-item-row"
      data-status={item.status}
      className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-elevated p-3"
    >
      <button
        onClick={cycleStatus}
        disabled={isPending}
        className="shrink-0 cursor-pointer"
        aria-label="Toggle action item status"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : icons[item.status]}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm ${
            item.status === "completed" ? "text-muted-foreground line-through" : ""
          }`}
        >
          {item.description}
        </p>
        {item.topic && (
          <Badge variant="secondary" className="mt-1 text-xs">
            {item.topic}
          </Badge>
        )}
      </div>
      <Badge
        variant={
          item.status === "completed"
            ? "default"
            : item.status === "in_progress"
              ? "secondary"
              : "outline"
        }
        className={`shrink-0 text-xs ${
          item.status === "completed"
            ? "border-win/30 bg-win/15 text-win"
            : item.status === "in_progress"
              ? "border-status-progress/30 bg-status-progress/15 text-status-progress"
              : ""
        }`}
      >
        {item.status.replace("_", " ")}
      </Badge>
    </div>
  );
}

export function CoachingDetailClient({
  session,
  linkedMatches,
  actionItems,
  ddragonVersion,
  highlightsByMatch,
  progressMatches,
  progressHighlightsByMatch,
}: CoachingDetailClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const locale = user?.locale ?? DEFAULT_LOCALE;
  const t = useTranslations("CoachingDetail");
  const [isDeleting, startDelete] = useTransition();

  const topics: string[] = session.topics ? JSON.parse(session.topics) : [];
  const focusAreas: string[] = session.focusAreas ? JSON.parse(session.focusAreas) : [];

  const isScheduled = session.status === "scheduled";

  const dateStr = formatDate(session.date, locale, isScheduled ? "datetime" : "long");

  const completedCount = actionItems.filter((i) => i.status === "completed").length;

  // Collect action item topics for highlighting in progress matches
  const actionItemTopics = useMemo(
    () => new Set(actionItems.map((i) => i.topic).filter(Boolean) as string[]),
    [actionItems],
  );

  // Compute progress stats
  const progressStats = useMemo(() => {
    if (progressMatches.length === 0) return null;
    const wins = progressMatches.filter((m) => m.result === "Victory").length;
    const meaningful = progressMatches.filter((m) => m.result !== "Remake").length;
    const totalKills = progressMatches.reduce((s, m) => s + m.kills, 0);
    const totalDeaths = progressMatches.reduce((s, m) => s + m.deaths, 0);
    const totalAssists = progressMatches.reduce((s, m) => s + m.assists, 0);

    // Count highlights/lowlights that match action item topics
    let relevantHighlights = 0;
    let relevantLowlights = 0;
    for (const match of progressMatches) {
      const hl = progressHighlightsByMatch[match.id] || [];
      for (const h of hl) {
        if (h.topic && actionItemTopics.has(h.topic)) {
          if (h.type === "highlight") relevantHighlights++;
          else relevantLowlights++;
        }
      }
    }

    return {
      total: meaningful,
      wins,
      winRate: meaningful > 0 ? Math.round((wins / meaningful) * 100) : 0,
      avgKDA:
        totalDeaths === 0 ? t("perfect") : ((totalKills + totalAssists) / totalDeaths).toFixed(1),
      relevantHighlights,
      relevantLowlights,
    };
  }, [progressMatches, progressHighlightsByMatch, actionItemTopics, t]);

  function handleDelete() {
    if (!confirm(t("deleteConfirm"))) return;
    startDelete(async () => {
      try {
        await deleteCoachingSession(session.id);
        toast.success(t("toasts.sessionDeleted"));
        router.push("/coaching");
      } catch {
        toast.error(t("toasts.deleteError"));
      }
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/coaching">
          <Button variant="ghost" size="icon" aria-label="Back to coaching">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-gold" />
            <h1 className="text-gradient-gold text-xl font-bold">{session.coachName}</h1>
            <Badge variant={isScheduled ? "secondary" : "default"} className="text-xs">
              {isScheduled ? t("badgeScheduled") : t("badgeCompleted")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {dateStr}
            {session.durationMinutes && (
              <>
                {" "}
                <Clock className="inline h-3 w-3" />{" "}
                {t("durationMinutes", { minutes: session.durationMinutes })}
              </>
            )}
          </p>
        </div>
        <Link href={`/coaching/${session.id}/edit`}>
          <Button variant="ghost" size="icon" aria-label="Edit session">
            <Pencil className="h-4 w-4" />
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-destructive"
          aria-label="Delete session"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Scheduled: CTA to complete */}
      {isScheduled && (
        <Card className="border-gold/30 bg-gold/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarCheck className="h-5 w-5 text-gold" />
                <div>
                  <p className="font-medium">{t("sessionIsScheduled")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("sessionIsScheduledDescription")}
                  </p>
                </div>
              </div>
              <Link href={`/coaching/${session.id}/complete`}>
                <Button>{t("completeSessionButton")}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Focus Areas (planned) — for completed sessions that have separate focusAreas */}
      {!isScheduled && focusAreas.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("focusAreasPlanned")}
          </span>
          <div className="flex flex-wrap gap-2">
            {focusAreas.map((area) => (
              <Badge key={area} variant="outline" className="border-gold/30 text-gold">
                {area}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Topics Covered (actual) — or Focus Areas for scheduled sessions */}
      {topics.length > 0 && (
        <div className="space-y-1">
          {!isScheduled && focusAreas.length > 0 && (
            <span className="text-xs font-medium text-muted-foreground">
              {t("topicsCoveredActual")}
            </span>
          )}
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <Badge key={topic} variant="secondary">
                {topic}
              </Badge>
            ))}
            {isScheduled && (
              <span className="ml-1 self-center text-xs text-muted-foreground">
                {t("focusAreasLabel")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {session.notes && (
        <Card className="surface-glow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("sessionNotes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Linked Games */}
      {linkedMatches.length > 0 && (
        <Card className="surface-glow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {isScheduled ? t("vodToReview") : t("gameReviewed")}
            </CardTitle>
            {!isScheduled && (
              <CardDescription>
                {t("gamesDiscussed", { count: linkedMatches.length })}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {linkedMatches.map((match) => {
                const matchHL: HighlightItem[] = (highlightsByMatch[match.id] || []).map((h) => ({
                  type: h.type,
                  text: h.text,
                  topic: h.topic || undefined,
                }));

                return (
                  <div key={match.id} className="space-y-3">
                    {/* Match row */}
                    <Link
                      href={`/matches/${match.id}`}
                      className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-elevated"
                    >
                      <ResultBar result={match.result} />
                      <Image
                        src={getChampionIconUrl(ddragonVersion, match.championName)}
                        alt={match.championName}
                        width={32}
                        height={32}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">{match.championName}</span>
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          {t("vs")}
                          {match.matchupChampionName ? (
                            <>
                              <Image
                                src={getChampionIconUrl(ddragonVersion, match.matchupChampionName)}
                                alt={match.matchupChampionName}
                                width={16}
                                height={16}
                                className="rounded"
                              />
                              {match.matchupChampionName}
                            </>
                          ) : (
                            "?"
                          )}
                        </span>
                      </div>
                      <span className="font-mono text-sm text-gold">
                        {match.kills}/{match.deaths}/{match.assists}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(match.gameDurationSeconds)}
                      </span>
                      <ResultBadge result={match.result} />
                    </Link>

                    {/* VOD link */}
                    {match.vodUrl && (
                      <div className="ml-3 flex items-center gap-2">
                        <Video className="h-3.5 w-3.5 text-electric" />
                        <a
                          href={match.vodUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 truncate text-xs text-electric hover:underline"
                        >
                          {t("watchVod")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}

                    {/* Highlights / Lowlights */}
                    {matchHL.length > 0 && (
                      <div className="ml-3">
                        <HighlightsDisplay highlights={matchHL} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Items (only for completed sessions) */}
      {!isScheduled && (
        <>
          <Separator />

          <Card className="surface-glow">
            <CardHeader>
              <CardTitle className="text-base">{t("actionItems")}</CardTitle>
              <CardDescription>
                {t("actionItemsDescription", {
                  completed: completedCount,
                  total: actionItems.length,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noActionItems")}</p>
              ) : (
                <div className="space-y-2">
                  {actionItems.map((item) => (
                    <ActionItemRow key={item.id} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Progress Since This Session (only for completed sessions with matches) */}
      {!isScheduled && progressMatches.length > 0 && progressStats && (
        <>
          <Separator />

          <Card className="surface-glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-gold" />
                {t("progressSinceSession")}
              </CardTitle>
              <CardDescription>
                {t("progressDescription", { count: progressStats.total })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 text-center">
                  <p className="font-mono text-lg font-bold text-gold">{progressStats.winRate}%</p>
                  <p className="text-xs text-muted-foreground">{t("winRate")}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {progressStats.wins}W {progressStats.total - progressStats.wins}L
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 text-center">
                  <p className="font-mono text-lg font-bold text-gold">{progressStats.avgKDA}</p>
                  <p className="text-xs text-muted-foreground">{t("avgKda")}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {progressStats.relevantHighlights > 0 && (
                      <span className="font-mono text-sm font-bold text-win">
                        {progressStats.relevantHighlights}
                      </span>
                    )}
                    {progressStats.relevantLowlights > 0 && (
                      <span className="font-mono text-sm font-bold text-loss">
                        {progressStats.relevantLowlights}
                      </span>
                    )}
                    {progressStats.relevantHighlights === 0 &&
                      progressStats.relevantLowlights === 0 && (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("relatedNotes")}</p>
                </div>
              </div>

              {/* Individual matches */}
              <div className="space-y-3">
                {progressMatches.map((match) => {
                  const matchHL = progressHighlightsByMatch[match.id] || [];
                  const highlights: HighlightItem[] = matchHL.map((h) => ({
                    type: h.type,
                    text: h.text,
                    topic: h.topic || undefined,
                  }));

                  // Check which highlights relate to action items
                  const hasRelevantNotes = matchHL.some(
                    (h) => h.topic && actionItemTopics.has(h.topic),
                  );

                  const matchDateStr = formatDate(match.gameDate, locale, "short-compact");

                  return (
                    <div
                      key={match.id}
                      className={`space-y-2 rounded-lg border p-3 ${
                        hasRelevantNotes
                          ? "border-gold/30 bg-gold/5"
                          : "border-border/50 bg-surface-elevated"
                      }`}
                    >
                      {/* Match summary row */}
                      <Link
                        href={`/matches/${match.id}`}
                        className="flex items-center gap-3 transition-opacity hover:opacity-80"
                      >
                        <ResultBar result={match.result} size="sm" />
                        <Image
                          src={getChampionIconUrl(ddragonVersion, match.championName)}
                          alt={match.championName}
                          width={24}
                          height={24}
                          className="rounded"
                        />
                        <span className="text-sm font-medium">{match.championName}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          {t("vs")}
                          {match.matchupChampionName ? (
                            <>
                              <Image
                                src={getChampionIconUrl(ddragonVersion, match.matchupChampionName)}
                                alt={match.matchupChampionName}
                                width={16}
                                height={16}
                                className="rounded"
                              />
                              {match.matchupChampionName}
                            </>
                          ) : (
                            "?"
                          )}
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                          <span className="font-mono text-xs text-gold">
                            {match.kills}/{match.deaths}/{match.assists}
                          </span>
                          <span className="text-xs text-muted-foreground">{matchDateStr}</span>
                          <ResultBadge result={match.result} />
                        </div>
                      </Link>

                      {/* Highlights with action item topic highlighting */}
                      {highlights.length > 0 && (
                        <div className="ml-4">
                          <div className="space-y-1">
                            {highlights.map((h, i) => {
                              const isRelevant = h.topic && actionItemTopics.has(h.topic);
                              return (
                                <div
                                  key={i}
                                  className={`flex items-start gap-2 rounded px-2 py-1 text-xs ${
                                    isRelevant ? "border border-gold/20 bg-gold/10" : ""
                                  }`}
                                >
                                  <Swords
                                    className={`mt-0.5 h-3 w-3 shrink-0 ${
                                      h.type === "highlight" ? "text-win" : "text-loss"
                                    }`}
                                  />
                                  <span className={isRelevant ? "text-gold" : ""}>{h.text}</span>
                                  {h.topic && (
                                    <Badge
                                      variant={isRelevant ? "default" : "secondary"}
                                      className="shrink-0 px-1.5 py-0 text-[10px]"
                                    >
                                      {h.topic}
                                      {isRelevant && " *"}
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty progress state for completed sessions */}
      {!isScheduled && progressMatches.length === 0 && (
        <>
          <Separator />
          <div className="py-6 text-center">
            <Swords className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("noGamesSinceSession")}</p>
          </div>
        </>
      )}
    </div>
  );
}

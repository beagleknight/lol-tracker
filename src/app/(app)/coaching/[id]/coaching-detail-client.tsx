"use client";

import {
  Loader2,
  GraduationCap,
  Trash2,
  Clock,
  CheckCircle2,
  Circle,
  Video,
  ExternalLink,
  CalendarCheck,
  TrendingUp,
  Swords,
  Pencil,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import type { CoachingSession, CoachingActionItem } from "@/db/schema";

import { updateActionItemStatus, deleteCoachingSession } from "@/app/actions/coaching";
import { BackButton } from "@/components/back-button";
import { HighlightsDisplay, type HighlightItem } from "@/components/highlights-editor";
import { ChampionIcon } from "@/components/icons/champion-icon";
import { MatchCard, type MatchCardData, type MatchHighlightData } from "@/components/match-card";
import { ResultBadge, ResultBar } from "@/components/result-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-client";
import { formatDate, formatDuration, DEFAULT_LOCALE } from "@/lib/format";
import { safeExternalUrl } from "@/lib/url";

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

interface CoachingDetailClientProps {
  session: CoachingSession;
  linkedMatches: LinkedMatch[];
  actionItems: CoachingActionItem[];
  ddragonVersion: string;
  topicNames: { id: number; name: string }[];
  sessionTopicNames: string[];
  highlightsByMatch: Record<
    string,
    Array<{
      type: "highlight" | "lowlight";
      text: string | null;
      topicId?: number;
      topicName?: string;
    }>
  >;
  progressMatches: MatchCardData[];
  progressHighlightsByMatch: Record<
    string,
    Array<{
      type: "highlight" | "lowlight";
      text: string | null;
      topicId?: number;
      topicName?: string;
    }>
  >;
}

function ActionItemRow({
  item,
  topicNames,
}: {
  item: CoachingActionItem;
  topicNames: { id: number; name: string }[];
}) {
  const t = useTranslations("CoachingDetail");
  const [isPending, startTransition] = useTransition();

  // Signal that React has hydrated this component (event handlers attached).
  // Used by E2E tests to avoid clicking before hydration completes (#95).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Optimistic status so the UI updates immediately on click (#74).
  // useOptimistic survives server re-renders during a transition — unlike
  // the previous useState + sync useEffect which could be clobbered by a
  // revalidation flight arriving with stale props, causing flaky E2E (#102).
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(item.status);

  const nextStatusMap: Record<string, "active" | "completed"> = {
    active: "completed",
    completed: "active",
  };

  function cycleStatus() {
    const next = nextStatusMap[optimisticStatus];
    startTransition(async () => {
      setOptimisticStatus(next);
      try {
        await updateActionItemStatus(item.id, next);
        toast.success(t("toasts.statusUpdated", { status: next }));
      } catch {
        toast.error(t("toasts.statusUpdateError"));
      }
    });
  }

  const displayStatus = optimisticStatus;

  const icons = {
    active: <Circle className="h-4 w-4 text-status-progress" />,
    completed: <CheckCircle2 className="h-4 w-4 text-win" />,
  };

  return (
    <div
      data-testid="action-item-row"
      data-status={displayStatus}
      data-hydrated={hydrated || undefined}
      className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-elevated p-3"
    >
      <button
        onClick={cycleStatus}
        disabled={isPending}
        className="shrink-0 cursor-pointer"
        aria-label="Toggle action item status"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : icons[displayStatus]}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm ${
            displayStatus === "completed" ? "text-muted-foreground line-through" : ""
          }`}
        >
          {item.description}
        </p>
        {item.topicId != null && (
          <Badge variant="secondary" className="mt-1 text-xs">
            {topicNames.find((t) => t.id === item.topicId)?.name ?? item.topicId}
          </Badge>
        )}
      </div>
      <Badge
        variant={displayStatus === "completed" ? "default" : "secondary"}
        className={`shrink-0 text-xs ${
          displayStatus === "completed"
            ? "border-win/30 bg-win/15 text-win"
            : "border-status-progress/30 bg-status-progress/15 text-status-progress"
        }`}
      >
        {displayStatus}
      </Badge>
    </div>
  );
}

export function CoachingDetailClient({
  session,
  linkedMatches,
  actionItems,
  ddragonVersion,
  topicNames,
  sessionTopicNames,
  highlightsByMatch,
  progressMatches,
  progressHighlightsByMatch,
}: CoachingDetailClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const locale = user?.locale ?? DEFAULT_LOCALE;
  const t = useTranslations("CoachingDetail");
  const [isDeleting, startDelete] = useTransition();

  const topics: string[] = sessionTopicNames;
  const focusAreas: string[] = session.focusAreas ? JSON.parse(session.focusAreas) : [];

  const isScheduled = session.status === "scheduled";

  const dateStr = formatDate(session.date, locale, isScheduled ? "datetime" : "long");

  const completedCount = actionItems.filter((i) => i.status === "completed").length;

  // Collect action item topics for highlighting in progress matches
  const actionItemTopics = useMemo(
    () =>
      new Set(
        actionItems
          .map((i) => topicNames.find((tn) => tn.id === i.topicId)?.name)
          .filter(Boolean) as string[],
      ),
    [actionItems, topicNames],
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
        if (h.topicName && actionItemTopics.has(h.topicName)) {
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
        <BackButton />
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
                  topicId: h.topicId,
                  topicName: h.topicName,
                }));

                return (
                  <div key={match.id} className="space-y-3">
                    {/* Match row */}
                    <Link
                      href={`/matches/${match.id}`}
                      className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-elevated"
                    >
                      <ResultBar result={match.result} />
                      <ChampionIcon championName={match.championName} size={32} />
                      <div className="flex-1">
                        <span className="text-sm font-medium">{match.championName}</span>
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          {t("vs")}
                          {match.matchupChampionName ? (
                            <>
                              <ChampionIcon championName={match.matchupChampionName} size={16} />
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
                          href={safeExternalUrl(match.vodUrl) ?? "#"}
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
                    <ActionItemRow key={item.id} item={item} topicNames={topicNames} />
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
                  const matchHighlights: MatchHighlightData[] = matchHL.map((h) => ({
                    type: h.type,
                    text: h.text,
                    topicName: h.topicName,
                  }));

                  // Check which highlights relate to action items
                  const hasRelevantNotes = matchHL.some(
                    (h) => h.topicName && actionItemTopics.has(h.topicName),
                  );

                  return (
                    <div
                      key={match.id}
                      className={
                        hasRelevantNotes
                          ? "rounded-lg border border-gold/30 bg-gold/5 p-1"
                          : undefined
                      }
                    >
                      <MatchCard
                        match={match}
                        ddragonVersion={ddragonVersion}
                        matchHighlights={matchHighlights}
                        locale={locale}
                        variant="compact"
                      />
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

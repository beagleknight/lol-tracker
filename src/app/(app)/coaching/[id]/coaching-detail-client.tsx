"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  updateActionItemStatus,
  deleteCoachingSession,
} from "@/app/actions/coaching";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getChampionIconUrl } from "@/lib/riot-api";
import {
  HighlightsDisplay,
  type HighlightItem,
} from "@/components/highlights-editor";
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
} from "lucide-react";
import type { CoachingSession, CoachingActionItem } from "@/db/schema";

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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ActionItemRow({ item }: { item: CoachingActionItem }) {
  const [isPending, startTransition] = useTransition();

  function cycleStatus() {
    const nextStatus: Record<
      string,
      "pending" | "in_progress" | "completed"
    > = {
      pending: "in_progress",
      in_progress: "completed",
      completed: "pending",
    };
    const next = nextStatus[item.status];
    startTransition(async () => {
      try {
        await updateActionItemStatus(item.id, next);
        toast.success(`Status updated to ${next.replace("_", " ")}.`);
      } catch {
        toast.error("Failed to update status.");
      }
    });
  }

  const icons = {
    pending: <Circle className="h-4 w-4 text-muted-foreground" />,
    in_progress: <Play className="h-4 w-4 text-yellow-500" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-400" />,
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 p-3 bg-surface-elevated">
      <button
        onClick={cycleStatus}
        disabled={isPending}
        className="shrink-0 cursor-pointer"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          icons[item.status]
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${
            item.status === "completed"
              ? "line-through text-muted-foreground"
              : ""
          }`}
        >
          {item.description}
        </p>
        {item.topic && (
          <Badge variant="secondary" className="text-xs mt-1">
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
        className="text-xs shrink-0"
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
  const [isDeleting, startDelete] = useTransition();

  const topics: string[] = session.topics
    ? JSON.parse(session.topics)
    : [];

  const dateStr = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(session.date);

  const completedCount = actionItems.filter(
    (i) => i.status === "completed"
  ).length;

  const isScheduled = session.status === "scheduled";

  // Collect action item topics for highlighting in progress matches
  const actionItemTopics = useMemo(
    () => new Set(actionItems.map((i) => i.topic).filter(Boolean) as string[]),
    [actionItems]
  );

  // Compute progress stats
  const progressStats = useMemo(() => {
    if (progressMatches.length === 0) return null;
    const wins = progressMatches.filter(
      (m) => m.result === "Victory"
    ).length;
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
      total: progressMatches.length,
      wins,
      winRate: Math.round((wins / progressMatches.length) * 100),
      avgKDA:
        totalDeaths === 0
          ? "Perfect"
          : ((totalKills + totalAssists) / totalDeaths).toFixed(1),
      relevantHighlights,
      relevantLowlights,
    };
  }, [progressMatches, progressHighlightsByMatch, actionItemTopics]);

  function handleDelete() {
    if (!confirm("Delete this coaching session? This cannot be undone."))
      return;
    startDelete(async () => {
      try {
        await deleteCoachingSession(session.id);
        toast.success("Session deleted.");
        router.push("/coaching");
      } catch {
        toast.error("Failed to delete session.");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/coaching">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-gold" />
            <h1 className="text-xl font-bold text-gradient-gold">
              {session.coachName}
            </h1>
            <Badge
              variant={isScheduled ? "secondary" : "default"}
              className="text-xs"
            >
              {isScheduled ? "Scheduled" : "Completed"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {dateStr}
            {session.durationMinutes && (
              <>
                {" "}
                <Clock className="inline h-3 w-3" /> {session.durationMinutes}{" "}
                min
              </>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-destructive"
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
                  <p className="font-medium">Session is scheduled</p>
                  <p className="text-sm text-muted-foreground">
                    After your coaching, fill in notes and action items.
                  </p>
                </div>
              </div>
              <Link href={`/coaching/${session.id}/complete`}>
                <Button>Complete Session</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Topics */}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
          {isScheduled && (
            <span className="text-xs text-muted-foreground self-center ml-1">
              (focus areas)
            </span>
          )}
        </div>
      )}

      {/* Notes */}
      {session.notes && (
        <Card className="surface-glow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Session Notes</CardTitle>
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
              {isScheduled ? "VOD to Review" : "Game Reviewed"}
            </CardTitle>
            {!isScheduled && (
              <CardDescription>
                {linkedMatches.length} game
                {linkedMatches.length !== 1 ? "s" : ""} discussed
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {linkedMatches.map((match) => {
                const matchHL: HighlightItem[] = (
                  highlightsByMatch[match.id] || []
                ).map((h) => ({
                  type: h.type,
                  text: h.text,
                  topic: h.topic || undefined,
                }));

                return (
                  <div key={match.id} className="space-y-3">
                    {/* Match row */}
                    <Link
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
                        src={getChampionIconUrl(
                          ddragonVersion,
                          match.championName
                        )}
                        alt={match.championName}
                        width={32}
                        height={32}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">
                          {match.championName}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2 inline-flex items-center gap-1">
                          vs
                          {match.matchupChampionName ? (
                            <>
                              <Image
                                src={getChampionIconUrl(
                                  ddragonVersion,
                                  match.matchupChampionName
                                )}
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
                      <span className="text-sm font-mono text-gold">
                        {match.kills}/{match.deaths}/{match.assists}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(match.gameDurationSeconds)}
                      </span>
                      <Badge
                        variant={
                          match.result === "Victory"
                            ? "default"
                            : "destructive"
                        }
                        className="text-xs"
                      >
                        {match.result === "Victory" ? "W" : "L"}
                      </Badge>
                    </Link>

                    {/* VOD link */}
                    {match.vodUrl && (
                      <div className="flex items-center gap-2 ml-3">
                        <Video className="h-3.5 w-3.5 text-electric" />
                        <a
                          href={match.vodUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-electric hover:underline truncate inline-flex items-center gap-1"
                        >
                          Watch VOD
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
              <CardTitle className="text-base">Action Items</CardTitle>
              <CardDescription>
                {completedCount}/{actionItems.length} completed. Click the
                status icon to cycle through: pending → in progress →
                completed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No action items for this session.
                </p>
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
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gold" />
                Progress Since This Session
              </CardTitle>
              <CardDescription>
                {progressStats.total} game
                {progressStats.total !== 1 ? "s" : ""} played since this
                coaching session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 text-center">
                  <p className="text-lg font-bold text-gold">
                    {progressStats.winRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                  <p className="text-xs text-muted-foreground">
                    {progressStats.wins}W{" "}
                    {progressStats.total - progressStats.wins}L
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 text-center">
                  <p className="text-lg font-bold text-gold">
                    {progressStats.avgKDA}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg KDA</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {progressStats.relevantHighlights > 0 && (
                      <span className="text-sm font-bold text-green-400">
                        {progressStats.relevantHighlights}
                      </span>
                    )}
                    {progressStats.relevantLowlights > 0 && (
                      <span className="text-sm font-bold text-red-400">
                        {progressStats.relevantLowlights}
                      </span>
                    )}
                    {progressStats.relevantHighlights === 0 &&
                      progressStats.relevantLowlights === 0 && (
                        <span className="text-sm text-muted-foreground">
                          —
                        </span>
                      )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Related Notes
                  </p>
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
                    (h) => h.topic && actionItemTopics.has(h.topic)
                  );

                  const matchDateStr = new Intl.DateTimeFormat("en-GB", {
                    day: "2-digit",
                    month: "short",
                  }).format(match.gameDate);

                  return (
                    <div
                      key={match.id}
                      className={`rounded-lg border p-3 space-y-2 ${
                        hasRelevantNotes
                          ? "border-gold/30 bg-gold/5"
                          : "border-border/50 bg-surface-elevated"
                      }`}
                    >
                      {/* Match summary row */}
                      <Link
                        href={`/matches/${match.id}`}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                      >
                        <div
                          className={`w-1 h-6 rounded-full ${
                            match.result === "Victory"
                              ? "bg-green-500"
                              : "bg-red-500"
                          }`}
                        />
                        <Image
                          src={getChampionIconUrl(
                            ddragonVersion,
                            match.championName
                          )}
                          alt={match.championName}
                          width={24}
                          height={24}
                          className="rounded"
                        />
                        <span className="text-sm font-medium">
                          {match.championName}
                        </span>
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          vs
                          {match.matchupChampionName ? (
                            <>
                              <Image
                                src={getChampionIconUrl(
                                  ddragonVersion,
                                  match.matchupChampionName
                                )}
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
                          <span className="text-xs font-mono text-gold">
                            {match.kills}/{match.deaths}/{match.assists}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {matchDateStr}
                          </span>
                          <Badge
                            variant={
                              match.result === "Victory"
                                ? "default"
                                : "destructive"
                            }
                            className="text-xs"
                          >
                            {match.result === "Victory" ? "W" : "L"}
                          </Badge>
                        </div>
                      </Link>

                      {/* Highlights with action item topic highlighting */}
                      {highlights.length > 0 && (
                        <div className="ml-4">
                          <div className="space-y-1">
                            {highlights.map((h, i) => {
                              const isRelevant =
                                h.topic && actionItemTopics.has(h.topic);
                              return (
                                <div
                                  key={i}
                                  className={`flex items-start gap-2 text-xs rounded px-2 py-1 ${
                                    isRelevant
                                      ? "bg-gold/10 border border-gold/20"
                                      : ""
                                  }`}
                                >
                                  <Swords
                                    className={`h-3 w-3 mt-0.5 shrink-0 ${
                                      h.type === "highlight"
                                        ? "text-green-400"
                                        : "text-red-400"
                                    }`}
                                  />
                                  <span
                                    className={
                                      isRelevant ? "text-gold" : ""
                                    }
                                  >
                                    {h.text}
                                  </span>
                                  {h.topic && (
                                    <Badge
                                      variant={
                                        isRelevant ? "default" : "secondary"
                                      }
                                      className="text-[10px] px-1.5 py-0 shrink-0"
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
          <div className="text-center py-6">
            <Swords className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No games played since this coaching session yet.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

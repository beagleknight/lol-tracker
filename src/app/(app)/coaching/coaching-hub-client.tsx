"use client";

import { useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { updateActionItemStatus } from "@/app/actions/coaching";
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
} from "lucide-react";
import type { CoachingSession, CoachingActionItem } from "@/db/schema";

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
  actionItemsBySession: Record<
    number,
    { total: number; completed: number }
  >;
  vodMatchMap: Record<string, VodMatchInfo>;
  intervalsData: Record<number, IntervalData>;
  ddragonVersion: string;
}

function ActionItemMiniRow({ item }: { item: CoachingActionItem }) {
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
      } catch {
        toast.error("Failed to update status.");
      }
    });
  }

  const icons = {
    pending: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
    in_progress: <Play className="h-3.5 w-3.5 text-yellow-500" />,
    completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
  };

  return (
    <div className="flex items-center gap-2 py-1.5">
      <button
        onClick={cycleStatus}
        disabled={isPending}
        className="shrink-0 cursor-pointer"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          icons[item.status]
        )}
      </button>
      <span className="text-sm truncate flex-1">{item.description}</span>
      {item.topic && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
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
  const totalSessions = scheduledSessions.length + completedSessions.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">
            Coaching
          </h1>
          <p className="text-muted-foreground">
            {totalSessions === 0
              ? "Track your coaching sessions and improvement."
              : `${totalSessions} session${totalSessions !== 1 ? "s" : ""} · ${activeActionItems.length} active action item${activeActionItems.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href="/coaching/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Schedule Session
          </Button>
        </Link>
      </div>

      {/* Empty state */}
      {totalSessions === 0 && activeActionItems.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <GraduationCap className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">No coaching sessions yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule your first coaching session to start tracking your
            improvement.
          </p>
          <Link href="/coaching/new" className="mt-4">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Schedule Session
            </Button>
          </Link>
        </div>
      )}

      {/* Upcoming Sessions */}
      {scheduledSessions.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CalendarCheck className="h-4 w-4 text-gold" />
            <h2 className="text-lg font-semibold">Upcoming Sessions</h2>
          </div>
          <div className="space-y-3">
            {scheduledSessions.map((session) => {
              const dateStr = new Intl.DateTimeFormat("en-GB", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric",
              }).format(session.date);
              const vodMatch = session.vodMatchId
                ? vodMatchMap[session.vodMatchId]
                : null;
              const topics: string[] = session.topics
                ? JSON.parse(session.topics)
                : [];

              return (
                <Link key={session.id} href={`/coaching/${session.id}`}>
                  <Card className="border-gold/20 bg-gold/5 hover:bg-gold/10 transition-colors cursor-pointer hover-lift">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GraduationCap className="h-5 w-5 text-gold shrink-0" />
                          <div>
                            <CardTitle className="text-base">
                              {session.coachName}
                            </CardTitle>
                            <CardDescription>{dateStr}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            Scheduled
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
                              src={getChampionIconUrl(
                                ddragonVersion,
                                vodMatch.championName
                              )}
                              alt={vodMatch.championName}
                              width={16}
                              height={16}
                              className="rounded"
                            />
                            {vodMatch.championName}
                            {vodMatch.matchupChampionName && (
                              <>
                                {" vs "}
                                <Image
                                  src={getChampionIconUrl(
                                    ddragonVersion,
                                    vodMatch.matchupChampionName
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
                            {topics.map((t) => (
                              <Badge
                                key={t}
                                variant="outline"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {t}
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
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-gold" />
              <h2 className="text-lg font-semibold">Active Action Items</h2>
              <Badge variant="secondary" className="text-xs">
                {activeActionItems.length}
              </Badge>
            </div>
            <Link href="/coaching/action-items">
              <Button variant="ghost" size="sm" className="text-xs">
                View All
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          <Card className="surface-glow">
            <CardContent className="pt-4 divide-y divide-border/50">
              {activeActionItems.slice(0, 8).map((item) => (
                <ActionItemMiniRow key={item.id} item={item} />
              ))}
              {activeActionItems.length > 8 && (
                <p className="text-xs text-muted-foreground pt-2">
                  +{activeActionItems.length - 8} more
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
          <div className="flex items-center gap-2 mb-3 mt-4">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Past Sessions</h2>
          </div>
          <div className="space-y-2">
            {completedSessions.map((session) => {
              const topics: string[] = session.topics
                ? JSON.parse(session.topics)
                : [];
              const items = actionItemsBySession[session.id];
              const interval = intervalsData[session.id];
              const dateStr = new Intl.DateTimeFormat("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }).format(session.date);

              return (
                <div key={session.id} className="space-y-2">
                  {/* Session Card */}
                  <Link href={`/coaching/${session.id}`}>
                    <Card className="hover:bg-surface-elevated transition-colors cursor-pointer hover-lift">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <GraduationCap className="h-5 w-5 text-gold shrink-0" />
                            <div>
                              <CardTitle className="text-base">
                                {session.coachName}
                              </CardTitle>
                              <CardDescription>
                                {dateStr}
                                {session.durationMinutes &&
                                  ` · ${session.durationMinutes} min`}
                              </CardDescription>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-1.5">
                          {topics.map((t) => (
                            <Badge
                              key={t}
                              variant="secondary"
                              className="text-xs"
                            >
                              {t}
                            </Badge>
                          ))}
                        </div>
                        {items && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {items.completed}/{items.total} action items
                            completed
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>

                  {/* Between-sessions interval */}
                  {interval && interval.matchCount > 0 && (
                    <div className="ml-6 flex items-center gap-3 py-1 text-xs text-muted-foreground">
                      <div className="w-0.5 h-4 bg-border" />
                      <Swords className="h-3 w-3 shrink-0" />
                      <span>
                        {interval.matchCount} game
                        {interval.matchCount !== 1 ? "s" : ""}
                      </span>
                      <span className="font-mono">
                        <span className="text-green-400">
                          {interval.wins}W
                        </span>{" "}
                        <span className="text-red-400">
                          {interval.losses}L
                        </span>
                      </span>
                      {interval.matchCount > 0 && (
                        <span>
                          {Math.round(
                            (interval.wins / interval.matchCount) * 100
                          )}
                          % WR
                        </span>
                      )}
                      {interval.relevantNoteCount > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-gold/30 text-gold"
                        >
                          <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                          {interval.relevantNoteCount} related note
                          {interval.relevantNoteCount !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  )}
                  {interval && interval.matchCount === 0 && (
                    <div className="ml-6 flex items-center gap-3 py-1 text-xs text-muted-foreground">
                      <div className="w-0.5 h-4 bg-border" />
                      <span className="italic">No games played</span>
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

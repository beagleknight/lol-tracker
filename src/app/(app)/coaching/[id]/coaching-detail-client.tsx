"use client";

import { useTransition } from "react";
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
import {
  ArrowLeft,
  Loader2,
  GraduationCap,
  Trash2,
  Clock,
  CheckCircle2,
  Circle,
  Play,
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
}

interface CoachingDetailClientProps {
  session: CoachingSession;
  linkedMatches: LinkedMatch[];
  actionItems: CoachingActionItem[];
  ddragonVersion: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ActionItemRow({ item }: { item: CoachingActionItem }) {
  const [isPending, startTransition] = useTransition();

  function cycleStatus() {
    const nextStatus: Record<string, "pending" | "in_progress" | "completed"> =
      {
        pending: "in_progress",
        in_progress: "completed",
        completed: "pending",
      };
    const next = nextStatus[item.status];
    startTransition(async () => {
      await updateActionItemStatus(item.id, next);
      toast.success(`Status updated to ${next.replace("_", " ")}.`);
    });
  }

  const icons = {
    pending: <Circle className="h-4 w-4 text-muted-foreground" />,
    in_progress: <Play className="h-4 w-4 text-yellow-500" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
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

  function handleDelete() {
    if (!confirm("Delete this coaching session? This cannot be undone.")) return;
    startDelete(async () => {
      await deleteCoachingSession(session.id);
      toast.success("Session deleted.");
      router.push("/coaching");
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
            <GraduationCap className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">{session.coachName}</h1>
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

      {/* Topics */}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>
      )}

      {/* Notes */}
      {session.notes && (
        <Card>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Games Reviewed</CardTitle>
            <CardDescription>
              {linkedMatches.length} game{linkedMatches.length !== 1 ? "s" : ""} discussed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {linkedMatches.map((match) => (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent transition-colors"
                >
                  <div
                    className={`w-1 h-8 rounded-full ${
                      match.result === "Victory"
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                  />
                  <Image
                    src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${match.championName}.png`}
                    alt={match.championName}
                    width={32}
                    height={32}
                    className="rounded"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">
                      {match.championName}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      vs {match.matchupChampionName || "?"}
                    </span>
                  </div>
                  <span className="text-sm font-mono">
                    {match.kills}/{match.deaths}/{match.assists}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(match.gameDurationSeconds)}
                  </span>
                  <Badge
                    variant={
                      match.result === "Victory" ? "default" : "destructive"
                    }
                    className="text-xs"
                  >
                    {match.result === "Victory" ? "W" : "L"}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Action Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Action Items</CardTitle>
          <CardDescription>
            {completedCount}/{actionItems.length} completed. Click the status
            icon to cycle through: pending → in progress → completed.
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
    </div>
  );
}

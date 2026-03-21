"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { updateMatchReview } from "@/app/actions/matches";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save, ChevronRight, CheckCircle2 } from "lucide-react";
import type { Match } from "@/db/schema";
import { getKeystoneIconUrlByName } from "@/lib/riot-api";
import { Pagination, paginate } from "@/components/pagination";

interface ReviewClientProps {
  matches: Match[];
  ddragonVersion: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function ReviewCard({
  match,
  ddragonVersion,
}: {
  match: Match;
  ddragonVersion: string;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function save() {
    startTransition(async () => {
      try {
        const result = await updateMatchReview(match.id, reviewed, notes);
        if (result.success) {
          toast.success("Review saved.");
          if (reviewed) setDone(true);
        } else {
          toast.error("Failed to save review.");
        }
      } catch {
        toast.error("Failed to save review.");
      }
    });
  }

  if (done) {
    return (
      <Card className="opacity-50">
        <CardContent className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm">Reviewed</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="surface-glow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-1 h-10 rounded-full ${
              match.result === "Victory" ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <Image
            src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${match.championName}.png`}
            alt={match.championName}
            width={40}
            height={40}
            className="rounded"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{match.championName}</CardTitle>
              <Badge
                variant={
                  match.result === "Victory" ? "default" : "destructive"
                }
                className="text-xs"
              >
                {match.result === "Victory" ? "W" : "L"}
              </Badge>
            </div>
            <CardDescription className="inline-flex items-center gap-1 flex-wrap">
              {formatDate(match.gameDate)} &middot;{" "}
              {match.kills}/{match.deaths}/{match.assists} &middot;{" "}
              {formatDuration(match.gameDurationSeconds)} &middot;{" "}
              vs{" "}
              {match.matchupChampionName ? (
                <>
                  <Image
                    src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${match.matchupChampionName}.png`}
                    alt={match.matchupChampionName}
                    width={16}
                    height={16}
                    className="rounded"
                  />
                  {match.matchupChampionName}
                </>
              ) : "?"}
              {match.runeKeystoneName && (
                <>
                  {" "}&middot;{" "}
                  {(() => {
                    const iconUrl = getKeystoneIconUrlByName(match.runeKeystoneName);
                    return iconUrl ? (
                      <Image src={iconUrl} alt="" width={14} height={14} className="rounded-sm" />
                    ) : null;
                  })()}
                  {match.runeKeystoneName}
                </>
              )}
            </CardDescription>
          </div>
          <Link href={`/matches/${match.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        {match.comment && (
          <p className="text-sm text-muted-foreground mt-2 pl-12 italic">
            &ldquo;{match.comment}&rdquo;
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did you learn? Key mistakes? Patterns to fix?"
          rows={3}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`reviewed-${match.id}`}
              checked={reviewed}
              onCheckedChange={(v) => setReviewed(!!v)}
            />
            <label htmlFor={`reviewed-${match.id}`} className="text-sm">
              Mark as reviewed
            </label>
          </div>
          <Button size="sm" onClick={save} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-2 h-3 w-3" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReviewClient({ matches, ddragonVersion }: ReviewClientProps) {
  const [page, setPage] = useState(1);
  const paginatedMatches = paginate(matches, page);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">Review Queue</h1>
        <p className="text-muted-foreground">
          {matches.length} game{matches.length !== 1 ? "s" : ""} waiting for
          review.
        </p>
      </div>

      {matches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <CheckCircle2 className="h-8 w-8 text-gold mb-3" />
          <p className="text-lg font-medium">All caught up!</p>
          <p className="text-sm text-muted-foreground mt-1">
            No games waiting for review. Keep playing and syncing.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedMatches.map((match) => (
              <ReviewCard
                key={match.id}
                match={match}
                ddragonVersion={ddragonVersion}
              />
            ))}
          </div>
          <Pagination
            currentPage={page}
            totalItems={matches.length}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

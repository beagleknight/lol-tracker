"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { savePostGameReview } from "@/app/actions/matches";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  HighlightsEditor,
  HighlightsDisplay,
  type HighlightItem,
} from "@/components/highlights-editor";
import { SKIP_REVIEW_REASONS } from "@/lib/topics";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  MessageSquare,
  SkipForward,
  Link as LinkIcon,
} from "lucide-react";
import type { Match } from "@/db/schema";
import { getKeystoneIconUrlByName, getChampionIconUrl } from "@/lib/riot-api";
import { Pagination, paginate } from "@/components/pagination";

interface ReviewClientProps {
  matches: Match[];
  highlightsByMatch: Record<
    string,
    Array<{ id: number; type: "highlight" | "lowlight"; text: string; topic: string | null }>
  >;
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
  existingHighlights,
  ddragonVersion,
}: {
  match: Match;
  existingHighlights: HighlightItem[];
  ddragonVersion: string;
}) {
  const [highlights, setHighlights] = useState<HighlightItem[]>(existingHighlights);
  const [comment, setComment] = useState(match.comment || "");
  const [showComment, setShowComment] = useState(!!match.comment);
  const [vodUrl, setVodUrl] = useState(match.vodUrl || "");
  const [reviewNotes, setReviewNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [showSkipMenu, setShowSkipMenu] = useState(false);

  const hasContent = highlights.length > 0 || comment.trim() || vodUrl.trim() || reviewNotes.trim();

  const handleSave = useCallback(
    (skipReason?: string) => {
      startTransition(async () => {
        try {
          const result = await savePostGameReview(match.id, {
            highlights,
            comment: comment || undefined,
            vodUrl: vodUrl || undefined,
            reviewed: !!skipReason || !!reviewNotes,
            reviewNotes: reviewNotes || undefined,
            reviewSkippedReason: skipReason,
          });
          if (result.success) {
            toast.success(
              skipReason
                ? "Review saved & VOD review skipped."
                : "Review saved."
            );
            if (skipReason || reviewNotes) setDone(true);
          } else {
            toast.error("Failed to save review.");
          }
        } catch {
          toast.error("Failed to save review.");
        }
      });
    },
    [match.id, highlights, comment, vodUrl, reviewNotes]
  );

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
            src={getChampionIconUrl(ddragonVersion, match.championName)}
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
                    src={getChampionIconUrl(ddragonVersion, match.matchupChampionName)}
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
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Highlights / Lowlights (primary) */}
        <HighlightsEditor
          highlights={highlights}
          onChange={setHighlights}
        />

        {/* Game Notes (secondary, collapsible) */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowComment(!showComment)}
            className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <MessageSquare className="h-3 w-3" />
            Game Notes (optional)
            {match.comment && !showComment && (
              <span className="italic text-muted-foreground ml-1 truncate max-w-48">
                &ldquo;{match.comment}&rdquo;
              </span>
            )}
            <ChevronDown
              className={`h-3 w-3 transition-transform ${
                showComment ? "rotate-180" : ""
              }`}
            />
          </button>
          {showComment && (
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              className="text-sm resize-none"
            />
          )}
        </div>

        {/* Ascent VOD Link */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <LinkIcon className="h-3 w-3" />
            Ascent VOD Link (optional)
          </label>
          <Input
            value={vodUrl}
            onChange={(e) => setVodUrl(e.target.value)}
            placeholder="https://ascent.gg/vod/..."
            className="text-sm h-8"
          />
        </div>

        {/* VOD Review Notes (for actual VOD reviews) */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            VOD Review Notes (marks as reviewed)
          </label>
          <Textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="What did you learn from watching the VOD?"
            rows={2}
            className="text-sm resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          {/* Skip VOD Review */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSkipMenu(!showSkipMenu)}
              disabled={isPending || !hasContent}
              className="gap-1.5"
            >
              <SkipForward className="h-3 w-3" />
              Save & Skip VOD
            </Button>
            {showSkipMenu && (
              <div className="absolute bottom-full right-0 mb-1 w-56 rounded-md border bg-popover p-1 shadow-md z-10">
                {SKIP_REVIEW_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => {
                      setShowSkipMenu(false);
                      handleSave(reason);
                    }}
                    className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Save */}
          <Button size="sm" onClick={() => handleSave()} disabled={isPending || !hasContent}>
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

export function ReviewClient({ matches, highlightsByMatch, ddragonVersion }: ReviewClientProps) {
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
            {paginatedMatches.map((match) => {
              const existing = (highlightsByMatch[match.id] || []).map((h) => ({
                type: h.type,
                text: h.text,
                topic: h.topic || undefined,
              }));
              return (
                <ReviewCard
                  key={match.id}
                  match={match}
                  existingHighlights={existing}
                  ddragonVersion={ddragonVersion}
                />
              );
            })}
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

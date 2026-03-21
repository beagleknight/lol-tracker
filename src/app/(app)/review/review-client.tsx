"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { savePostGameReview, bulkMarkReviewed } from "@/app/actions/matches";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  HighlightsEditor,
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
import { ChampionLink } from "@/components/champion-link";
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
  onReviewed,
}: {
  match: Match;
  existingHighlights: HighlightItem[];
  ddragonVersion: string;
  onReviewed: (matchId: string) => void;
}) {
  const [highlights, setHighlights] = useState<HighlightItem[]>(existingHighlights);
  const [comment, setComment] = useState(match.comment || "");
  const [showComment, setShowComment] = useState(!!match.comment);
  const [vodUrl, setVodUrl] = useState(match.vodUrl || "");
  const [reviewNotes, setReviewNotes] = useState("");
  const [isPending, startTransition] = useTransition();

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
            if (skipReason || reviewNotes) {
              onReviewed(match.id);
            }
          } else {
            toast.error("Failed to save review.");
          }
        } catch {
          toast.error("Failed to save review.");
        }
      });
    },
    [match.id, highlights, comment, vodUrl, reviewNotes, onReviewed]
  );

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
                <ChampionLink
                  champion={match.matchupChampionName}
                  ddragonVersion={ddragonVersion}
                  linkTo="scout-enemy"
                  yourChampion={match.championName}
                  iconSize={16}
                  textClassName="text-xs"
                />
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
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={isPending || !hasContent}
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                >
                  <SkipForward className="h-3 w-3" />
                  Save & Skip VOD
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {SKIP_REVIEW_REASONS.map((reason) => (
                <DropdownMenuItem
                  key={reason}
                  onSelect={() => handleSave(reason)}
                >
                  {reason}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

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
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulkTransition] = useTransition();
  const [bulkSkipReason, setBulkSkipReason] = useState<string>(SKIP_REVIEW_REASONS[0]);

  const remainingMatches = useMemo(
    () => matches.filter((m) => !reviewedIds.has(m.id)),
    [matches, reviewedIds]
  );

  const reviewedCount = reviewedIds.size;
  const totalCount = matches.length;
  const remainingCount = remainingMatches.length;

  const paginatedMatches = paginate(remainingMatches, page);

  // Reset to page 1 if current page becomes empty after reviews
  const totalPages = Math.ceil(remainingCount / 10);
  if (page > totalPages && totalPages > 0) {
    setPage(totalPages);
  }

  const handleReviewed = useCallback((matchId: string) => {
    setReviewedIds((prev) => {
      const next = new Set(prev);
      next.add(matchId);
      return next;
    });
  }, []);

  const handleBulkMarkReviewed = useCallback(() => {
    startBulkTransition(async () => {
      try {
        const result = await bulkMarkReviewed(bulkSkipReason);
        if (result.success) {
          toast.success(`Marked ${result.count} game${result.count !== 1 ? "s" : ""} as reviewed.`);
          // Mark all remaining as reviewed locally
          setReviewedIds((prev) => {
            const next = new Set(prev);
            for (const m of matches) next.add(m.id);
            return next;
          });
        } else {
          toast.error("Failed to mark games as reviewed.");
        }
      } catch {
        toast.error("Failed to mark games as reviewed.");
      }
    });
  }, [bulkSkipReason, matches]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">Review Queue</h1>
          {totalCount === 0 ? (
            <p className="text-muted-foreground">No games waiting for review.</p>
          ) : remainingCount === 0 ? (
            <p className="text-muted-foreground">All {totalCount} games reviewed!</p>
          ) : (
            <p className="text-muted-foreground">
              {reviewedCount > 0 && (
                <span className="text-green-400">{reviewedCount} reviewed</span>
              )}
              {reviewedCount > 0 && ` · `}
              {remainingCount} game{remainingCount !== 1 ? "s" : ""} remaining
            </p>
          )}
          {/* Progress bar */}
          {totalCount > 0 && reviewedCount > 0 && (
            <div className="mt-2 h-1.5 w-48 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${(reviewedCount / totalCount) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Bulk action */}
        {remainingCount > 0 && (
          <AlertDialog>
            <AlertDialogTrigger render={
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                <SkipForward className="h-3 w-3" />
                Mark All Reviewed
              </Button>
            } />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Mark all {remainingCount} games as reviewed?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will skip VOD review for all remaining games in the queue. This action cannot be undone from this page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="px-0">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Skip reason
                </label>
                <div className="flex flex-col gap-1.5">
                  {SKIP_REVIEW_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setBulkSkipReason(reason)}
                      className={`text-left rounded-md border px-3 py-2 text-sm transition-colors ${
                        bulkSkipReason === reason
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkMarkReviewed}
                  disabled={isBulkPending}
                >
                  {isBulkPending ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <SkipForward className="mr-2 h-3 w-3" />
                  )}
                  Mark All Reviewed
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {remainingCount === 0 ? (
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
                  onReviewed={handleReviewed}
                />
              );
            })}
          </div>
          <Pagination
            currentPage={page}
            totalItems={remainingCount}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

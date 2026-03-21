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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
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
  Eye,
  EyeOff,
  ClipboardEdit,
  Video,
  ExternalLink,
} from "lucide-react";
import type { Match } from "@/db/schema";
import { getKeystoneIconUrlByName, getChampionIconUrl } from "@/lib/riot-api";
import { ChampionLink } from "@/components/champion-link";
import { Pagination, paginate } from "@/components/pagination";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReviewClientProps {
  unreviewedMatches: Match[];
  recentReviewedMatches: Match[];
  highlightsByMatch: Record<
    string,
    Array<{
      id: number;
      type: "highlight" | "lowlight";
      text: string;
      topic: string | null;
    }>
  >;
  ddragonVersion: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Match Header (shared across card types) ────────────────────────────────

function MatchCardHeader({
  match,
  ddragonVersion,
}: {
  match: Match;
  ddragonVersion: string;
}) {
  return (
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
          ) : (
            "?"
          )}
          {match.runeKeystoneName && (
            <>
              {" "}&middot;{" "}
              {(() => {
                const iconUrl = getKeystoneIconUrlByName(
                  match.runeKeystoneName
                );
                return iconUrl ? (
                  <Image
                    src={iconUrl}
                    alt=""
                    width={14}
                    height={14}
                    className="rounded-sm"
                  />
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
  );
}

// ─── Post-Game Review Card ──────────────────────────────────────────────────
// For games with NO highlights and NO comment — fresh, never-touched games.
// Shows: highlights editor, game notes, VOD URL, save + skip buttons.

function PostGameCard({
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
  const [highlights, setHighlights] =
    useState<HighlightItem[]>(existingHighlights);
  const [comment, setComment] = useState(match.comment || "");
  const [showComment, setShowComment] = useState(!!match.comment);
  const [vodUrl, setVodUrl] = useState(match.vodUrl || "");
  const [isPending, startTransition] = useTransition();

  const hasContent =
    highlights.length > 0 || comment.trim() || vodUrl.trim();

  const handleSave = useCallback(
    (skipReason?: string) => {
      startTransition(async () => {
        try {
          const result = await savePostGameReview(match.id, {
            highlights,
            comment: comment || undefined,
            vodUrl: vodUrl || undefined,
            reviewed: !!skipReason,
            reviewSkippedReason: skipReason,
          });
          if (result.success) {
            toast.success(
              skipReason
                ? "Review saved & VOD review skipped."
                : "Post-game review saved!"
            );
            // If skipped, move to completed; otherwise move to VOD Review
            onReviewed(match.id);
          } else {
            toast.error("Failed to save review.");
          }
        } catch {
          toast.error("Failed to save review.");
        }
      });
    },
    [match.id, highlights, comment, vodUrl, onReviewed]
  );

  return (
    <Card className="surface-glow">
      <CardHeader className="pb-3">
        <MatchCardHeader match={match} ddragonVersion={ddragonVersion} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Highlights / Lowlights (primary) */}
        <HighlightsEditor highlights={highlights} onChange={setHighlights} />

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

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          {/* Skip VOD Review */}
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={isPending || !hasContent}
              render={
                <Button variant="outline" size="sm" className="gap-1.5">
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
          <Button
            size="sm"
            onClick={() => handleSave()}
            disabled={isPending || !hasContent}
          >
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

// ─── VOD Review Card ────────────────────────────────────────────────────────
// For games that have post-game notes but haven't been VOD-reviewed yet.
// Shows existing highlights/notes as read-only context, plus VOD fields.

function VodReviewCard({
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
  const [vodUrl, setVodUrl] = useState(match.vodUrl || "");
  const [reviewNotes, setReviewNotes] = useState(match.reviewNotes || "");
  const [isPending, startTransition] = useTransition();

  const hasContent = vodUrl.trim() || reviewNotes.trim();

  const handleSave = useCallback(
    (skipReason?: string) => {
      startTransition(async () => {
        try {
          const result = await savePostGameReview(match.id, {
            highlights: existingHighlights, // preserve existing
            comment: match.comment || undefined,
            vodUrl: vodUrl || undefined,
            reviewed: !!skipReason || !!reviewNotes,
            reviewNotes: reviewNotes || undefined,
            reviewSkippedReason: skipReason,
          });
          if (result.success) {
            toast.success(
              skipReason
                ? "VOD review skipped."
                : "VOD review saved!"
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
    [match.id, match.comment, existingHighlights, vodUrl, reviewNotes, onReviewed]
  );

  return (
    <Card className="surface-glow">
      <CardHeader className="pb-3">
        <MatchCardHeader match={match} ddragonVersion={ddragonVersion} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing post-game notes — read-only context */}
        {existingHighlights.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Post-game notes
            </p>
            <HighlightsDisplay highlights={existingHighlights} compact />
          </div>
        )}
        {match.comment && (
          <div className="rounded-md border border-border/50 bg-surface/30 p-2.5">
            <p className="text-xs text-muted-foreground italic">
              &ldquo;{match.comment}&rdquo;
            </p>
          </div>
        )}

        {/* Ascent VOD Link */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <LinkIcon className="h-3 w-3" />
            Ascent VOD Link
          </label>
          <Input
            value={vodUrl}
            onChange={(e) => setVodUrl(e.target.value)}
            placeholder="https://ascent.gg/vod/..."
            className="text-sm h-8"
          />
          {match.vodUrl && (
            <a
              href={match.vodUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-electric hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Open VOD
            </a>
          )}
        </div>

        {/* VOD Review Notes */}
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
                <Button variant="outline" size="sm" className="gap-1.5">
                  <SkipForward className="h-3 w-3" />
                  Skip VOD
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
          <Button
            size="sm"
            onClick={() => handleSave()}
            disabled={isPending || !hasContent}
          >
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

// ─── Completed Card ─────────────────────────────────────────────────────────
// Read-only card showing a reviewed game for reference.

function CompletedCard({
  match,
  existingHighlights,
  ddragonVersion,
}: {
  match: Match;
  existingHighlights: HighlightItem[];
  ddragonVersion: string;
}) {
  return (
    <Card className="surface-glow opacity-80">
      <CardHeader className="pb-3">
        <MatchCardHeader match={match} ddragonVersion={ddragonVersion} />
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Highlights */}
        {existingHighlights.length > 0 && (
          <HighlightsDisplay highlights={existingHighlights} compact />
        )}

        {/* Comment */}
        {match.comment && (
          <p className="text-xs text-muted-foreground italic truncate">
            &ldquo;{match.comment}&rdquo;
          </p>
        )}

        {/* Review info row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {match.vodUrl && (
            <a
              href={match.vodUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-electric hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              VOD
            </a>
          )}
          {match.reviewNotes && (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {match.reviewNotes.length > 60
                ? match.reviewNotes.slice(0, 60) + "..."
                : match.reviewNotes}
            </span>
          )}
          {match.reviewSkippedReason && (
            <span className="inline-flex items-center gap-1 italic">
              <SkipForward className="h-3 w-3" />
              Skipped: {match.reviewSkippedReason}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab Content Wrapper ────────────────────────────────────────────────────

function TabEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <Icon className="h-8 w-8 text-gold mb-3" />
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

// ─── Main Review Client ─────────────────────────────────────────────────────

export function ReviewClient({
  unreviewedMatches,
  recentReviewedMatches,
  highlightsByMatch,
  ddragonVersion,
}: ReviewClientProps) {
  // Track which matches have been actioned this session (optimistic removal/movement)
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());

  // Bulk action state
  const [isBulkPending, startBulkTransition] = useTransition();
  const [bulkSkipReason, setBulkSkipReason] = useState<string>(
    SKIP_REVIEW_REASONS[0]
  );

  // Pagination state per tab
  const [postGamePage, setPostGamePage] = useState(1);
  const [vodReviewPage, setVodReviewPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);

  // Partition unreviewed matches into Post-Game vs VOD Review
  const { postGameMatches, vodReviewMatches } = useMemo(() => {
    const remaining = unreviewedMatches.filter(
      (m) => !actionedIds.has(m.id)
    );
    const postGame: Match[] = [];
    const vodReview: Match[] = [];

    for (const m of remaining) {
      const highlights = highlightsByMatch[m.id] || [];
      const hasNotes = highlights.length > 0 || !!m.comment;
      if (hasNotes) {
        vodReview.push(m);
      } else {
        postGame.push(m);
      }
    }
    return { postGameMatches: postGame, vodReviewMatches: vodReview };
  }, [unreviewedMatches, actionedIds, highlightsByMatch]);

  // Completed matches = server-provided reviewed + any actioned this session
  const completedMatches = useMemo(() => {
    // Include recently-actioned from unreviewed list
    const actionedMatches = unreviewedMatches.filter((m) =>
      actionedIds.has(m.id)
    );
    return [...actionedMatches, ...recentReviewedMatches];
  }, [unreviewedMatches, recentReviewedMatches, actionedIds]);

  const handleReviewed = useCallback((matchId: string) => {
    setActionedIds((prev) => {
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
          toast.success(
            `Marked ${result.count} game${result.count !== 1 ? "s" : ""} as reviewed.`
          );
          // Mark all remaining unreviewed as actioned
          setActionedIds((prev) => {
            const next = new Set(prev);
            for (const m of unreviewedMatches) next.add(m.id);
            return next;
          });
        } else {
          toast.error("Failed to mark games as reviewed.");
        }
      } catch {
        toast.error("Failed to mark games as reviewed.");
      }
    });
  }, [bulkSkipReason, unreviewedMatches]);

  const totalUnreviewed = postGameMatches.length + vodReviewMatches.length;

  // Paginated data
  const paginatedPostGame = paginate(postGameMatches, postGamePage);
  const paginatedVodReview = paginate(vodReviewMatches, vodReviewPage);
  const paginatedCompleted = paginate(completedMatches, completedPage);

  // Auto-correct pages when items are removed
  const postGameTotalPages = Math.ceil(postGameMatches.length / 10);
  const vodReviewTotalPages = Math.ceil(vodReviewMatches.length / 10);
  if (postGamePage > postGameTotalPages && postGameTotalPages > 0) {
    setPostGamePage(postGameTotalPages);
  }
  if (vodReviewPage > vodReviewTotalPages && vodReviewTotalPages > 0) {
    setVodReviewPage(vodReviewTotalPages);
  }

  function getHighlightItems(matchId: string): HighlightItem[] {
    return (highlightsByMatch[matchId] || []).map((h) => ({
      type: h.type,
      text: h.text,
      topic: h.topic || undefined,
    }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">
            Review
          </h1>
          {totalUnreviewed === 0 ? (
            <p className="text-muted-foreground">
              All caught up! No games waiting for review.
            </p>
          ) : (
            <p className="text-muted-foreground">
              {totalUnreviewed} game{totalUnreviewed !== 1 ? "s" : ""}{" "}
              waiting for review
            </p>
          )}
        </div>

        {/* Bulk action */}
        {totalUnreviewed > 0 && (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                >
                  <SkipForward className="h-3 w-3" />
                  Mark All Reviewed
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Mark all {totalUnreviewed} games as reviewed?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will skip VOD review for all remaining games. This
                  action cannot be undone from this page.
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

      {/* Tabs */}
      <Tabs defaultValue={0}>
        <TabsList>
          <TabsTrigger value={0}>
            <ClipboardEdit className="h-3.5 w-3.5" />
            Post-Game
            {postGameMatches.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {postGameMatches.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value={1}>
            <Video className="h-3.5 w-3.5" />
            VOD Review
            {vodReviewMatches.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {vodReviewMatches.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value={2}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed
          </TabsTrigger>
        </TabsList>

        {/* Post-Game Tab */}
        <TabsContent value={0}>
          <div className="space-y-4 pt-4">
            {postGameMatches.length === 0 ? (
              <TabEmptyState
                icon={CheckCircle2}
                title="No post-game reviews pending"
                description="All games have been reviewed or are waiting for VOD review."
              />
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  These games haven&apos;t been reviewed yet. Add highlights,
                  notes, and optionally a VOD link.
                </p>
                {paginatedPostGame.map((match) => (
                  <PostGameCard
                    key={match.id}
                    match={match}
                    existingHighlights={getHighlightItems(match.id)}
                    ddragonVersion={ddragonVersion}
                    onReviewed={handleReviewed}
                  />
                ))}
                <Pagination
                  currentPage={postGamePage}
                  totalItems={postGameMatches.length}
                  onPageChange={setPostGamePage}
                />
              </>
            )}
          </div>
        </TabsContent>

        {/* VOD Review Tab */}
        <TabsContent value={1}>
          <div className="space-y-4 pt-4">
            {vodReviewMatches.length === 0 ? (
              <TabEmptyState
                icon={Video}
                title="No VOD reviews pending"
                description="Complete post-game reviews first, then they'll appear here for VOD review."
              />
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  These games have post-game notes but haven&apos;t been
                  VOD-reviewed yet. Watch the VOD and add your takeaways.
                </p>
                {paginatedVodReview.map((match) => (
                  <VodReviewCard
                    key={match.id}
                    match={match}
                    existingHighlights={getHighlightItems(match.id)}
                    ddragonVersion={ddragonVersion}
                    onReviewed={handleReviewed}
                  />
                ))}
                <Pagination
                  currentPage={vodReviewPage}
                  totalItems={vodReviewMatches.length}
                  onPageChange={setVodReviewPage}
                />
              </>
            )}
          </div>
        </TabsContent>

        {/* Completed Tab */}
        <TabsContent value={2}>
          <div className="space-y-4 pt-4">
            {completedMatches.length === 0 ? (
              <TabEmptyState
                icon={EyeOff}
                title="No completed reviews yet"
                description="Reviewed games will appear here for reference."
              />
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Recently reviewed games for reference (last 20).
                </p>
                {paginatedCompleted.map((match) => (
                  <CompletedCard
                    key={match.id}
                    match={match}
                    existingHighlights={getHighlightItems(match.id)}
                    ddragonVersion={ddragonVersion}
                  />
                ))}
                <Pagination
                  currentPage={completedPage}
                  totalItems={completedMatches.length}
                  onPageChange={setCompletedPage}
                />
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

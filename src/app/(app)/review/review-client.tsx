"use client";

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
  Pencil,
  X,
  Ellipsis,
  Sparkles,
  Crosshair,
  Globe,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, useCallback, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";

import type { Match } from "@/db/schema";

import { savePostGameReview, bulkMarkReviewed } from "@/app/actions/matches";
import { EmptyState } from "@/components/empty-state";
import {
  HighlightsEditor,
  HighlightsDisplay,
  type HighlightItem,
  type TopicOption,
} from "@/components/highlights-editor";
import { Pagination, paginate } from "@/components/pagination";
import { PositionIcon, getRoleRelevance, getPositionLabel } from "@/components/position-icon";
import { ResultBadge, ResultBar } from "@/components/result-badge";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth-client";
import { formatDate, formatDuration, DEFAULT_LOCALE } from "@/lib/format";
import { getKeystoneIconUrlByName, getChampionIconUrl } from "@/lib/riot-api";
import { SKIP_REVIEW_REASONS } from "@/lib/topics";
import { safeExternalUrl } from "@/lib/url";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReviewClientProps {
  unreviewedMatches: Match[];
  reviewedMatches: Match[];
  highlightsByMatch: Record<
    string,
    Array<{
      id: number;
      type: "highlight" | "lowlight";
      text: string;
      topicId?: number;
      topicName?: string;
    }>
  >;
  ddragonVersion: string;
  completedPage: number;
  completedTotalPages: number;
  completedTotal: number;
  initialTab: "post-game" | "vod" | "completed";
  topics: TopicOption[];
  readOnly?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * F1.2 — Priority scoring heuristic for review ordering.
 * Higher score = more worth reviewing. Factors:
 * - Losses score higher than wins (more to learn)
 * - High death count (deaths > 7)
 * - Long games (> 25 min) have more to review
 * - Close games (KDA near 1.0) are more instructive
 */
function computePriorityScore(match: Match): number {
  let score = 0;

  // Losses are more instructive
  if (match.result === "Defeat") score += 3;

  // High deaths
  if (match.deaths > 7) score += 2;
  else if (match.deaths > 4) score += 1;

  // Long games have more to review
  if (match.gameDurationSeconds > 25 * 60) score += 1;

  // Close games (low KDA ratio → more to learn)
  const kda =
    match.deaths === 0 ? match.kills + match.assists : (match.kills + match.assists) / match.deaths;
  if (kda < 2) score += 2;
  else if (kda < 3) score += 1;

  return score;
}

/** Threshold: score >= 4 gets "Suggested" badge */
const PRIORITY_THRESHOLD = 4;

// ─── Match Header (shared across card types) ────────────────────────────────

function MatchCardHeaderInfo({
  match,
  ddragonVersion,
  locale,
}: {
  match: Match;
  ddragonVersion: string;
  locale: string;
}) {
  const t = useTranslations("Review");
  const { user } = useAuth();
  const roleRelevance = getRoleRelevance(match.position, user?.primaryRole);
  const positionIconColor =
    roleRelevance === "main"
      ? "text-gold"
      : roleRelevance === "off-role"
        ? "text-warning"
        : "text-muted-foreground";

  return (
    <div className="flex items-center gap-3">
      <ResultBar result={match.result} size="lg" />
      {match.position && (
        <PositionIcon
          position={match.position}
          size={16}
          className={`shrink-0 ${positionIconColor}`}
          aria-label={getPositionLabel(match.position)}
        />
      )}
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
          <ResultBadge result={match.result} />
        </div>
        <CardDescription className="inline-flex flex-wrap items-center gap-1">
          {formatDate(match.gameDate, locale)} &middot;{" "}
          <span className="font-mono">
            {match.kills}/{match.deaths}/{match.assists}
          </span>{" "}
          &middot; <span className="font-mono">{formatDuration(match.gameDurationSeconds)}</span>{" "}
          &middot; {t("vs")}{" "}
          {match.matchupChampionName ? (
            <>
              <Image
                src={getChampionIconUrl(ddragonVersion, match.matchupChampionName)}
                alt={match.matchupChampionName}
                width={16}
                height={16}
                unoptimized
                className="rounded"
              />
              <span className="text-xs">{match.matchupChampionName}</span>
            </>
          ) : (
            "?"
          )}
          {match.runeKeystoneName && (
            <>
              {" "}
              &middot;{" "}
              {(() => {
                const iconUrl = getKeystoneIconUrlByName(match.runeKeystoneName);
                return iconUrl ? (
                  <Image
                    src={iconUrl}
                    alt=""
                    width={14}
                    height={14}
                    unoptimized
                    className="rounded-sm"
                  />
                ) : null;
              })()}
              {match.runeKeystoneName}
            </>
          )}
        </CardDescription>
      </div>
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
  locale,
  isExpanded,
  onToggleExpand,
  priorityScore,
  topics,
}: {
  match: Match;
  existingHighlights: HighlightItem[];
  ddragonVersion: string;
  onReviewed: (matchId: string) => void;
  locale: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  priorityScore: number;
  topics: TopicOption[];
}) {
  const [highlights, setHighlights] = useState<HighlightItem[]>(existingHighlights);
  const [comment, setComment] = useState(match.comment || "");
  const [showComment, setShowComment] = useState(!!match.comment);
  const [vodUrl, setVodUrl] = useState(match.vodUrl || "");
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("Review");

  const hasContent = highlights.length > 0 || comment.trim() || vodUrl.trim();

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
              skipReason ? t("toasts.reviewSavedAndSkipped") : t("toasts.postGameReviewSaved"),
            );
            // If skipped, move to completed; otherwise move to VOD Review
            onReviewed(match.id);
          } else {
            toast.error(t("toasts.failedToSaveReview"));
          }
        } catch {
          toast.error(t("toasts.failedToSaveReview"));
        }
      });
    },
    [match.id, highlights, comment, vodUrl, onReviewed, t],
  );

  return (
    <Card className="surface-glow">
      <CardHeader className="pb-3">
        <div className="flex w-full items-center gap-3">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex flex-1 items-center gap-3 text-left"
          >
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "" : "-rotate-90"}`}
            />
            <div className="flex-1">
              <MatchCardHeaderInfo match={match} ddragonVersion={ddragonVersion} locale={locale} />
            </div>
          </button>
          {priorityScore >= PRIORITY_THRESHOLD && (
            <Badge variant="secondary" className="gap-1 text-gold">
              <Sparkles className="h-3 w-3" />
              {t("suggested")}
            </Badge>
          )}
          <Link href={`/matches/${match.id}`} aria-label={t("viewMatchDetails")}>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Highlights / Lowlights (primary) */}
          <HighlightsEditor highlights={highlights} onChange={setHighlights} topics={topics} />
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowComment(!showComment)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <MessageSquare className="h-3 w-3" />
              {t("gameNotesOptional")}
              {match.comment && !showComment && (
                <span className="ml-1 max-w-48 truncate text-muted-foreground italic">
                  &ldquo;{match.comment}&rdquo;
                </span>
              )}
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showComment ? "rotate-180" : ""}`}
              />
            </button>
            {showComment && (
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("gameNotesPlaceholder")}
                rows={2}
                className="resize-none text-sm"
              />
            )}
          </div>

          {/* VOD Link */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <LinkIcon className="h-3 w-3" />
              {t("vodLinkOptional")}
            </label>
            <Input
              value={vodUrl}
              onChange={(e) => setVodUrl(e.target.value)}
              placeholder={t("vodLinkGenericPlaceholder")}
              className="h-8 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            {/* Skip VOD Review */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        disabled={isPending || !hasContent}
                        render={
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <SkipForward className="h-3 w-3" />
                            {t("saveAndSkipVod")}
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        {SKIP_REVIEW_REASONS.map((reason) => (
                          <DropdownMenuItem key={reason} onClick={() => handleSave(reason)}>
                            {reason}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                }
              />
              {!hasContent && !isPending && (
                <TooltipContent>{t("disabledSaveTooltip")}</TooltipContent>
              )}
            </Tooltip>

            {/* Save */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <div>
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
                      {t("save")}
                    </Button>
                  </div>
                }
              />
              {!hasContent && !isPending && (
                <TooltipContent>{t("disabledSaveTooltip")}</TooltipContent>
              )}
            </Tooltip>
          </div>
        </CardContent>
      )}
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
  locale,
  isExpanded,
  onToggleExpand,
}: {
  match: Match;
  existingHighlights: HighlightItem[];
  ddragonVersion: string;
  onReviewed: (matchId: string) => void;
  locale: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const [vodUrl, setVodUrl] = useState(match.vodUrl || "");
  const [reviewNotes, setReviewNotes] = useState(match.reviewNotes || "");
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("Review");

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
            toast.success(skipReason ? t("toasts.vodReviewSkipped") : t("toasts.vodReviewSaved"));
            if (skipReason || reviewNotes) {
              onReviewed(match.id);
            }
          } else {
            toast.error(t("toasts.failedToSaveReview"));
          }
        } catch {
          toast.error(t("toasts.failedToSaveReview"));
        }
      });
    },
    [match.id, match.comment, existingHighlights, vodUrl, reviewNotes, onReviewed, t],
  );

  return (
    <Card className="surface-glow">
      <CardHeader className="pb-3">
        <div className="flex w-full items-center gap-3">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex flex-1 items-center gap-3 text-left"
          >
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "" : "-rotate-90"}`}
            />
            <div className="flex-1">
              <MatchCardHeaderInfo match={match} ddragonVersion={ddragonVersion} locale={locale} />
            </div>
          </button>
          <Link href={`/matches/${match.id}`} aria-label={t("viewMatchDetails")}>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Existing post-game notes — read-only context */}
          {existingHighlights.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{t("postGameNotes")}</p>
              <HighlightsDisplay highlights={existingHighlights} compact />
            </div>
          )}
          {match.comment && (
            <div className="rounded-md border border-border/50 bg-surface/30 p-2.5">
              <p className="line-clamp-3 text-xs text-foreground/70 italic">
                &ldquo;{match.comment}&rdquo;
              </p>
            </div>
          )}

          {/* VOD Link */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <LinkIcon className="h-3 w-3" />
              {t("vodLink")}
            </label>
            <Input
              value={vodUrl}
              onChange={(e) => setVodUrl(e.target.value)}
              placeholder={t("vodLinkGenericPlaceholder")}
              className="h-8 text-sm"
            />
            {match.vodUrl && (
              <a
                href={safeExternalUrl(match.vodUrl) ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-electric hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {t("openVod")}
              </a>
            )}
          </div>

          {/* VOD Review Notes */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("vodReviewNotesLabel")}
            </label>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder={t("vodReviewNotesPlaceholder")}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            {/* Skip VOD Review */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        disabled={isPending || !hasContent}
                        render={
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <SkipForward className="h-3 w-3" />
                            {t("skipVod")}
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        {SKIP_REVIEW_REASONS.map((reason) => (
                          <DropdownMenuItem key={reason} onClick={() => handleSave(reason)}>
                            {reason}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                }
              />
              {!hasContent && !isPending && (
                <TooltipContent>{t("disabledSaveTooltip")}</TooltipContent>
              )}
            </Tooltip>

            {/* Save */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <div>
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
                      {t("save")}
                    </Button>
                  </div>
                }
              />
              {!hasContent && !isPending && (
                <TooltipContent>{t("disabledSaveTooltip")}</TooltipContent>
              )}
            </Tooltip>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Completed Card ─────────────────────────────────────────────────────────
// Read-only card with inline edit toggle for reviewed games.

function CompletedCard({
  match,
  existingHighlights,
  ddragonVersion,
  onSaved,
  locale,
  topics,
  readOnly,
}: {
  match: Match;
  existingHighlights: HighlightItem[];
  ddragonVersion: string;
  onSaved: () => void;
  locale: string;
  topics: TopicOption[];
  readOnly?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [highlights, setHighlights] = useState<HighlightItem[]>(existingHighlights);
  const [comment, setComment] = useState(match.comment || "");
  const [vodUrl, setVodUrl] = useState(match.vodUrl || "");
  const [reviewNotes, setReviewNotes] = useState(match.reviewNotes || "");
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("Review");

  const handleSave = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await savePostGameReview(match.id, {
          highlights,
          comment: comment || undefined,
          vodUrl: vodUrl || undefined,
          reviewed: true,
          reviewNotes: reviewNotes || undefined,
        });
        if (result.success) {
          toast.success(t("toasts.reviewUpdated"));
          setIsEditing(false);
          onSaved();
        } else {
          toast.error(t("toasts.failedToUpdateReview"));
        }
      } catch {
        toast.error(t("toasts.failedToUpdateReview"));
      }
    });
  }, [match.id, highlights, comment, vodUrl, reviewNotes, onSaved, t]);

  const handleCancel = useCallback(() => {
    // Reset to original values
    setHighlights(existingHighlights);
    setComment(match.comment || "");
    setVodUrl(match.vodUrl || "");
    setReviewNotes(match.reviewNotes || "");
    setIsEditing(false);
  }, [existingHighlights, match.comment, match.vodUrl, match.reviewNotes]);

  if (isEditing) {
    return (
      <Card className="surface-glow border-primary/30">
        <CardHeader className="pb-3">
          <MatchCardHeaderInfo match={match} ddragonVersion={ddragonVersion} locale={locale} />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Highlights / Lowlights */}
          <HighlightsEditor highlights={highlights} onChange={setHighlights} topics={topics} />

          {/* Game Notes */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              {t("gameNotes")}
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("gameNotesPlaceholder")}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* VOD Link */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <LinkIcon className="h-3 w-3" />
              {t("vodLink")}
            </label>
            <Input
              value={vodUrl}
              onChange={(e) => setVodUrl(e.target.value)}
              placeholder={t("vodLinkGenericPlaceholder")}
              className="h-8 text-sm"
            />
          </div>

          {/* VOD Review Notes */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("vodReviewNotes")}
            </label>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder={t("vodReviewNotesPlaceholder")}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isPending}>
              <X className="mr-1.5 h-3 w-3" />
              {t("cancel")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Save className="mr-2 h-3 w-3" />
              )}
              {t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="surface-glow opacity-80 transition-opacity hover:opacity-100">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <MatchCardHeaderInfo match={match} ddragonVersion={ddragonVersion} locale={locale} />
          </div>
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setIsEditing(true)}
              aria-label="Edit review"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Highlights */}
        {existingHighlights.length > 0 && (
          <HighlightsDisplay highlights={existingHighlights} compact />
        )}

        {/* Comment */}
        {match.comment && (
          <div className="rounded-md border border-border/50 bg-surface/30 p-2.5">
            <p className="line-clamp-2 text-xs text-muted-foreground italic">
              &ldquo;{match.comment}&rdquo;
            </p>
          </div>
        )}

        {/* Review info row */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {match.vodUrl && (
            <a
              href={safeExternalUrl(match.vodUrl) ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-electric hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {t("vod")}
            </a>
          )}
          {match.reviewNotes && (
            <span className="inline-flex items-start gap-1">
              <Eye className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="line-clamp-2">{match.reviewNotes}</span>
            </span>
          )}
          {match.reviewSkippedReason && (
            <span className="inline-flex items-center gap-1 italic">
              <SkipForward className="h-3 w-3" />
              {t("skippedReason", { reason: match.reviewSkippedReason })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab Content Wrapper ────────────────────────────────────────────────────

// ─── Server-side pagination for Completed tab ───────────────────────────────

function CompletedPagination({
  currentPage,
  totalPages,
  disabled,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "ellipsis")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={currentPage === 1 || disabled}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
      </Button>
      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground">
            ...
          </span>
        ) : (
          <Button
            key={p}
            variant={p === currentPage ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8 text-xs"
            disabled={disabled}
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ),
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={currentPage === totalPages || disabled}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Main Review Client ─────────────────────────────────────────────────────

export function ReviewClient({
  unreviewedMatches,
  reviewedMatches,
  highlightsByMatch,
  ddragonVersion,
  completedPage,
  completedTotalPages,
  completedTotal,
  initialTab,
  topics,
  readOnly,
}: ReviewClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const locale = user?.locale ?? DEFAULT_LOCALE;
  const t = useTranslations("Review");

  // Track which matches have been actioned this session (optimistic removal/movement)
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());

  // F1.1 — Accordion state: only one card expanded at a time per tab
  const [expandedPostGameId, setExpandedPostGameId] = useState<string | null>(null);
  const [expandedVodId, setExpandedVodId] = useState<string | null>(null);

  // Bulk action state
  const [isBulkPending, startBulkTransition] = useTransition();
  const [bulkSkipReason, setBulkSkipReason] = useState<string>(SKIP_REVIEW_REASONS[0]);

  // Pagination state for Post-Game and VOD Review tabs (client-side)
  const [postGamePage, setPostGamePage] = useState(1);
  const [vodReviewPage, setVodReviewPage] = useState(1);

  // Server-side pagination for Completed tab
  const [isCompletedNavigating, startCompletedTransition] = useTransition();

  // Tab state — controlled to avoid Base UI uncontrolled defaultValue warning
  const tabValue = readOnly ? 2 : initialTab === "completed" ? 2 : initialTab === "vod" ? 1 : 0;

  // Tab change handler — sync tab to URL
  const handleTabChange = useCallback(
    (value: unknown) => {
      const tabMap: Record<number, string> = {
        0: "post-game",
        1: "vod",
        2: "completed",
      };
      const tabName = typeof value === "number" ? tabMap[value] : String(value);
      if (!tabName) return;
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("tab", tabName);
      // Reset completedPage when switching away from completed tab
      if (tabName !== "completed") sp.delete("completedPage");
      router.replace(`/review?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const navigateCompletedPage = useCallback(
    (page: number) => {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("tab", "completed");
      if (page > 1) sp.set("completedPage", String(page));
      else sp.delete("completedPage");
      startCompletedTransition(() => {
        router.push(`/review?${sp.toString()}`, { scroll: false });
      });
    },
    [router, searchParams],
  );

  // Partition unreviewed matches into Post-Game vs VOD Review
  // F1.2 — Sort by priority score (highest first)
  const { postGameMatches, vodReviewMatches, priorityScores } = useMemo(() => {
    const remaining = unreviewedMatches.filter((m) => !actionedIds.has(m.id));
    const postGame: Match[] = [];
    const vodReview: Match[] = [];
    const scores: Record<string, number> = {};

    for (const m of remaining) {
      scores[m.id] = computePriorityScore(m);
      const highlights = highlightsByMatch[m.id] || [];
      const hasNotes = highlights.length > 0 || !!m.comment;
      if (hasNotes) {
        vodReview.push(m);
      } else {
        postGame.push(m);
      }
    }

    // Sort by priority score descending (most instructive first)
    postGame.sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
    vodReview.sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));

    return {
      postGameMatches: postGame,
      vodReviewMatches: vodReview,
      priorityScores: scores,
    };
  }, [unreviewedMatches, actionedIds, highlightsByMatch]);

  // F1.1 — Auto-expand the first card when no card is expanded
  const hasAutoExpandedPostGame = useRef(false);
  const hasAutoExpandedVod = useRef(false);

  useEffect(() => {
    if (
      !hasAutoExpandedPostGame.current &&
      postGameMatches.length > 0 &&
      expandedPostGameId === null
    ) {
      setExpandedPostGameId(postGameMatches[0].id);
      hasAutoExpandedPostGame.current = true;
    }
  }, [postGameMatches, expandedPostGameId]);

  useEffect(() => {
    if (!hasAutoExpandedVod.current && vodReviewMatches.length > 0 && expandedVodId === null) {
      setExpandedVodId(vodReviewMatches[0].id);
      hasAutoExpandedVod.current = true;
    }
  }, [vodReviewMatches, expandedVodId]);

  const handleReviewed = useCallback(
    (matchId: string) => {
      setActionedIds((prev) => {
        const next = new Set(prev);
        next.add(matchId);
        return next;
      });
      // F1.1 — Auto-advance to next card after reviewing
      if (expandedPostGameId === matchId) {
        const idx = postGameMatches.findIndex((m) => m.id === matchId);
        const nextMatch = postGameMatches[idx + 1];
        setExpandedPostGameId(nextMatch?.id ?? null);
      }
      if (expandedVodId === matchId) {
        const idx = vodReviewMatches.findIndex((m) => m.id === matchId);
        const nextMatch = vodReviewMatches[idx + 1];
        setExpandedVodId(nextMatch?.id ?? null);
      }

      // Auto-switch tab when current tab becomes empty (#78)
      // Compute next-state counts (after this match is removed)
      const nextPostGameCount = postGameMatches.filter((m) => m.id !== matchId).length;
      const nextVodCount = vodReviewMatches.filter((m) => m.id !== matchId).length;

      if (tabValue === 0 && nextPostGameCount === 0 && nextVodCount > 0) {
        handleTabChange(1);
      } else if (tabValue === 1 && nextVodCount === 0 && nextPostGameCount > 0) {
        handleTabChange(0);
      }
    },
    [
      expandedPostGameId,
      expandedVodId,
      postGameMatches,
      vodReviewMatches,
      tabValue,
      handleTabChange,
    ],
  );

  const handleCompletedSaved = useCallback(() => {
    // Refresh the page to get updated data from the server
    router.refresh();
  }, [router]);

  const handleBulkMarkReviewed = useCallback(() => {
    startBulkTransition(async () => {
      try {
        const result = await bulkMarkReviewed(bulkSkipReason);
        if (result.success) {
          toast.success(t("toasts.bulkMarkReviewed", { count: result.count }));
          // Mark all remaining unreviewed as actioned
          setActionedIds((prev) => {
            const next = new Set(prev);
            for (const m of unreviewedMatches) next.add(m.id);
            return next;
          });
        } else {
          toast.error(t("toasts.failedToMarkReviewed"));
        }
      } catch {
        toast.error(t("toasts.failedToMarkReviewed"));
      }
    });
  }, [bulkSkipReason, unreviewedMatches, t]);

  const totalUnreviewed = postGameMatches.length + vodReviewMatches.length;

  // F1.7 — Track original count for progress indicator
  const originalUnreviewedCount = unreviewedMatches.length;

  // Client-side paginated data for Post-Game and VOD Review
  const paginatedPostGame = paginate(postGameMatches, postGamePage);
  const paginatedVodReview = paginate(vodReviewMatches, vodReviewPage);

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
      topicId: h.topicId,
      topicName: h.topicName,
    }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-in-up flex items-start justify-between gap-4">
        <div>
          <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("pageTitle")}</h1>
          {totalUnreviewed === 0 ? (
            <p className="text-muted-foreground">{t("allCaughtUp")}</p>
          ) : (
            <p className="text-muted-foreground">
              {t("gamesWaitingForReview", { count: totalUnreviewed })}
            </p>
          )}
          {/* F1.7 — Session progress indicator */}
          {actionedIds.size > 0 && originalUnreviewedCount > 0 && (
            <p className="mt-1 text-xs text-gold">
              {t("sessionProgress", {
                done: actionedIds.size,
                total: originalUnreviewedCount,
              })}
            </p>
          )}
        </div>

        {/* F1.3 — Overflow menu with Mark All Reviewed */}
        {!readOnly && totalUnreviewed > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={t("moreActions")}
                >
                  <Ellipsis className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-auto">
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="whitespace-nowrap"
                    >
                      <SkipForward className="mr-2 h-3.5 w-3.5 shrink-0" />
                      {t("markAllReviewed")}
                    </DropdownMenuItem>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("markAllReviewedConfirmTitle", {
                        count: totalUnreviewed,
                      })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("markAllReviewedConfirmDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="px-0">
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {t("skipReason")}
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {SKIP_REVIEW_REASONS.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => setBulkSkipReason(reason)}
                          className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
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
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkMarkReviewed} disabled={isBulkPending}>
                      {isBulkPending ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <SkipForward className="mr-2 h-3 w-3" />
                      )}
                      {t("markAllReviewed")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {!readOnly && !user?.primaryRole && (
        <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-gold-light">
          <Crosshair className="h-4 w-4 shrink-0" />
          <span>
            {t.rich("setRolePreferences", {
              link: (chunks) => (
                <Link href="/settings" className="font-medium underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </div>
      )}

      {!readOnly && user?.isRiotLinked && !user?.region && (
        <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-gold-light">
          <Globe className="h-4 w-4 shrink-0" />
          <span>
            {t.rich("selectRegion", {
              link: (chunks) => (
                <Link href="/settings" className="font-medium underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tabValue} onValueChange={handleTabChange}>
        <TabsList>
          {!readOnly && (
            <TabsTrigger value={0}>
              <ClipboardEdit className="h-3.5 w-3.5" />
              {t("tabs.postGame")}
              {postGameMatches.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                  {postGameMatches.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {!readOnly && (
            <TabsTrigger value={1}>
              <Video className="h-3.5 w-3.5" />
              {t("tabs.vodReview")}
              {vodReviewMatches.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                  {vodReviewMatches.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value={2}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("tabs.completed")}
            {completedTotal > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {completedTotal}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Post-Game Tab */}
        <TabsContent value={0}>
          <div className="space-y-4 pt-4">
            {postGameMatches.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title={t("emptyStates.noPostGameTitle")}
                description={t("emptyStates.noPostGameDescription")}
              />
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{t("postGameHint")}</p>
                {paginatedPostGame.map((match) => (
                  <PostGameCard
                    key={match.id}
                    match={match}
                    existingHighlights={getHighlightItems(match.id)}
                    ddragonVersion={ddragonVersion}
                    onReviewed={handleReviewed}
                    locale={locale}
                    isExpanded={expandedPostGameId === match.id}
                    onToggleExpand={() =>
                      setExpandedPostGameId((prev) => (prev === match.id ? null : match.id))
                    }
                    priorityScore={priorityScores[match.id] ?? 0}
                    topics={topics}
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
              <EmptyState
                icon={Video}
                title={t("emptyStates.noVodReviewTitle")}
                description={t("emptyStates.noVodReviewDescription")}
              />
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{t("vodReviewHint")}</p>
                {paginatedVodReview.map((match) => (
                  <VodReviewCard
                    key={match.id}
                    match={match}
                    existingHighlights={getHighlightItems(match.id)}
                    ddragonVersion={ddragonVersion}
                    onReviewed={handleReviewed}
                    locale={locale}
                    isExpanded={expandedVodId === match.id}
                    onToggleExpand={() =>
                      setExpandedVodId((prev) => (prev === match.id ? null : match.id))
                    }
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
          <div className="relative space-y-4 pt-4">
            {isCompletedNavigating && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {reviewedMatches.length === 0 && completedTotal === 0 ? (
              <EmptyState
                icon={EyeOff}
                title={t("emptyStates.noCompletedTitle")}
                description={t("emptyStates.noCompletedDescription")}
              />
            ) : (
              <div className={isCompletedNavigating ? "opacity-40" : ""}>
                <p className="text-xs text-muted-foreground">
                  {t("reviewedGamesCount", { count: completedTotal })}
                </p>
                <div className="mt-4 space-y-4">
                  {reviewedMatches.map((match) => (
                    <CompletedCard
                      key={match.id}
                      match={match}
                      existingHighlights={getHighlightItems(match.id)}
                      ddragonVersion={ddragonVersion}
                      onSaved={handleCompletedSaved}
                      locale={locale}
                      topics={topics}
                      readOnly={readOnly}
                    />
                  ))}
                </div>
                <CompletedPagination
                  currentPage={completedPage}
                  totalPages={completedTotalPages}
                  disabled={isCompletedNavigating}
                  onPageChange={navigateCompletedPage}
                />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

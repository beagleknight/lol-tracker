"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
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
  Pencil,
  X,
} from "lucide-react";
import type { Match } from "@/db/schema";
import { getKeystoneIconUrlByName, getChampionIconUrl } from "@/lib/riot-api";
import { ChampionLink } from "@/components/champion-link";
import { Pagination, paginate } from "@/components/pagination";
import { formatDate, formatDuration, DEFAULT_LOCALE } from "@/lib/format";

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
      topic: string | null;
    }>
  >;
  ddragonVersion: string;
  completedPage: number;
  completedTotalPages: number;
  completedTotal: number;
  initialTab: "post-game" | "vod" | "completed";
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// ─── Match Header (shared across card types) ────────────────────────────────

function MatchCardHeader({
  match,
  ddragonVersion,
  locale,
}: {
  match: Match;
  ddragonVersion: string;
  locale: string;
}) {
  const t = useTranslations("Review");
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-1 h-10 rounded-full ${
          match.result === "Victory" ? "bg-win" : "bg-loss"
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
            {match.result === "Victory" ? t("win") : t("loss")}
          </Badge>
        </div>
        <CardDescription className="inline-flex items-center gap-1 flex-wrap">
          {formatDate(match.gameDate, locale)} &middot;{" "}
          {match.kills}/{match.deaths}/{match.assists} &middot;{" "}
          {formatDuration(match.gameDurationSeconds)} &middot;{" "}
          {t("vs")}{" "}
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
  locale,
}: {
  match: Match;
  existingHighlights: HighlightItem[];
  ddragonVersion: string;
  onReviewed: (matchId: string) => void;
  locale: string;
}) {
  const [highlights, setHighlights] =
    useState<HighlightItem[]>(existingHighlights);
  const [comment, setComment] = useState(match.comment || "");
  const [showComment, setShowComment] = useState(!!match.comment);
  const [vodUrl, setVodUrl] = useState(match.vodUrl || "");
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("Review");

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
                ? t("toasts.reviewSavedAndSkipped")
                : t("toasts.postGameReviewSaved")
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
    [match.id, highlights, comment, vodUrl, onReviewed, t]
  );

  return (
    <Card className="surface-glow">
      <CardHeader className="pb-3">
        <MatchCardHeader match={match} ddragonVersion={ddragonVersion} locale={locale} />
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
            {t("gameNotesOptional")}
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
              placeholder={t("gameNotesPlaceholder")}
              rows={2}
              className="text-sm resize-none"
            />
          )}
        </div>

        {/* Ascent VOD Link */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <LinkIcon className="h-3 w-3" />
            {t("ascentVodLinkOptional")}
          </label>
          <Input
            value={vodUrl}
            onChange={(e) => setVodUrl(e.target.value)}
            placeholder={t("vodLinkPlaceholder")}
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
                  {t("saveAndSkipVod")}
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
            {t("save")}
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
  locale,
}: {
  match: Match;
  existingHighlights: HighlightItem[];
  ddragonVersion: string;
  onReviewed: (matchId: string) => void;
  locale: string;
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
            toast.success(
              skipReason
                ? t("toasts.vodReviewSkipped")
                : t("toasts.vodReviewSaved")
            );
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
    [match.id, match.comment, existingHighlights, vodUrl, reviewNotes, onReviewed, t]
  );

  return (
    <Card className="surface-glow">
      <CardHeader className="pb-3">
        <MatchCardHeader match={match} ddragonVersion={ddragonVersion} locale={locale} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing post-game notes — read-only context */}
        {existingHighlights.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("postGameNotes")}
            </p>
            <HighlightsDisplay highlights={existingHighlights} compact />
          </div>
        )}
        {match.comment && (
          <div className="rounded-md border border-border/50 bg-surface/30 p-2.5">
            <p className="text-xs text-foreground/70 italic line-clamp-3">
              &ldquo;{match.comment}&rdquo;
            </p>
          </div>
        )}

        {/* Ascent VOD Link */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <LinkIcon className="h-3 w-3" />
            {t("ascentVodLink")}
          </label>
          <Input
            value={vodUrl}
            onChange={(e) => setVodUrl(e.target.value)}
            placeholder={t("vodLinkPlaceholder")}
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
                  {t("skipVod")}
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
            {t("save")}
          </Button>
        </div>
      </CardContent>
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
}: {
  match: Match;
  existingHighlights: HighlightItem[];
  ddragonVersion: string;
  onSaved: () => void;
  locale: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [highlights, setHighlights] =
    useState<HighlightItem[]>(existingHighlights);
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
          <MatchCardHeader match={match} ddragonVersion={ddragonVersion} locale={locale} />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Highlights / Lowlights */}
          <HighlightsEditor highlights={highlights} onChange={setHighlights} />

          {/* Game Notes */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" />
              {t("gameNotes")}
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("gameNotesPlaceholder")}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Ascent VOD Link */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <LinkIcon className="h-3 w-3" />
              {t("ascentVodLink")}
            </label>
            <Input
              value={vodUrl}
              onChange={(e) => setVodUrl(e.target.value)}
              placeholder={t("vodLinkPlaceholder")}
              className="text-sm h-8"
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
              className="text-sm resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isPending}
            >
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
    <Card className="surface-glow opacity-80 hover:opacity-100 transition-opacity">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <MatchCardHeader match={match} ddragonVersion={ddragonVersion} locale={locale} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
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
            <p className="text-xs text-muted-foreground italic line-clamp-2">
              &ldquo;{match.comment}&rdquo;
            </p>
          </div>
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
              {t("vod")}
            </a>
          )}
          {match.reviewNotes && (
            <span className="inline-flex items-start gap-1">
              <Eye className="h-3 w-3 shrink-0 mt-0.5" />
              <span className="line-clamp-2">
                {match.reviewNotes}
              </span>
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
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
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
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
      </Button>
      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span
            key={`e-${i}`}
            className="px-1 text-xs text-muted-foreground"
          >
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
        )
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={currentPage === totalPages || disabled}
        onClick={() => onPageChange(currentPage + 1)}
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
}: ReviewClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const locale = session?.user?.locale ?? DEFAULT_LOCALE;
  const t = useTranslations("Review");

  // Track which matches have been actioned this session (optimistic removal/movement)
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());

  // Bulk action state
  const [isBulkPending, startBulkTransition] = useTransition();
  const [bulkSkipReason, setBulkSkipReason] = useState<string>(
    SKIP_REVIEW_REASONS[0]
  );

  // Pagination state for Post-Game and VOD Review tabs (client-side)
  const [postGamePage, setPostGamePage] = useState(1);
  const [vodReviewPage, setVodReviewPage] = useState(1);

  // Server-side pagination for Completed tab
  const [isCompletedNavigating, startCompletedTransition] = useTransition();

  // Tab state — controlled to avoid Base UI uncontrolled defaultValue warning
  const tabValue = initialTab === "completed" ? 2 : initialTab === "vod" ? 1 : 0;

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
    [router, searchParams]
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
    [router, searchParams]
  );

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

  const handleReviewed = useCallback((matchId: string) => {
    setActionedIds((prev) => {
      const next = new Set(prev);
      next.add(matchId);
      return next;
    });
  }, []);

  const handleCompletedSaved = useCallback(() => {
    // Refresh the page to get updated data from the server
    router.refresh();
  }, [router]);

  const handleBulkMarkReviewed = useCallback(() => {
    startBulkTransition(async () => {
      try {
        const result = await bulkMarkReviewed(bulkSkipReason);
        if (result.success) {
          toast.success(
            t("toasts.bulkMarkReviewed", { count: result.count })
          );
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
      topic: h.topic || undefined,
    }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">
            {t("pageTitle")}
          </h1>
          {totalUnreviewed === 0 ? (
            <p className="text-muted-foreground">
              {t("allCaughtUp")}
            </p>
          ) : (
            <p className="text-muted-foreground">
              {t("gamesWaitingForReview", { count: totalUnreviewed })}
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
                  {t("markAllReviewed")}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("markAllReviewedConfirmTitle", { count: totalUnreviewed })}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("markAllReviewedConfirmDescription")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="px-0">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t("skipReason")}
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
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkMarkReviewed}
                  disabled={isBulkPending}
                >
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
        )}
      </div>

      {/* Tabs */}
      <Tabs
        value={tabValue}
        onValueChange={handleTabChange}
      >
        <TabsList>
          <TabsTrigger value={0}>
            <ClipboardEdit className="h-3.5 w-3.5" />
            {t("tabs.postGame")}
            {postGameMatches.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {postGameMatches.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value={1}>
            <Video className="h-3.5 w-3.5" />
            {t("tabs.vodReview")}
            {vodReviewMatches.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {vodReviewMatches.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value={2}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("tabs.completed")}
            {completedTotal > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {completedTotal}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Post-Game Tab */}
        <TabsContent value={0}>
          <div className="space-y-4 pt-4">
            {postGameMatches.length === 0 ? (
              <TabEmptyState
                icon={CheckCircle2}
                title={t("emptyStates.noPostGameTitle")}
                description={t("emptyStates.noPostGameDescription")}
              />
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {t("postGameHint")}
                </p>
                {paginatedPostGame.map((match) => (
                  <PostGameCard
                    key={match.id}
                    match={match}
                    existingHighlights={getHighlightItems(match.id)}
                    ddragonVersion={ddragonVersion}
                    onReviewed={handleReviewed}
                    locale={locale}
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
                title={t("emptyStates.noVodReviewTitle")}
                description={t("emptyStates.noVodReviewDescription")}
              />
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {t("vodReviewHint")}
                </p>
                {paginatedVodReview.map((match) => (
                  <VodReviewCard
                    key={match.id}
                    match={match}
                    existingHighlights={getHighlightItems(match.id)}
                    ddragonVersion={ddragonVersion}
                    onReviewed={handleReviewed}
                    locale={locale}
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
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-lg">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {reviewedMatches.length === 0 && completedTotal === 0 ? (
              <TabEmptyState
                icon={EyeOff}
                title={t("emptyStates.noCompletedTitle")}
                description={t("emptyStates.noCompletedDescription")}
              />
            ) : (
              <div className={isCompletedNavigating ? "opacity-40" : ""}>
                <p className="text-xs text-muted-foreground">
                  {t("reviewedGamesCount", { count: completedTotal })}
                </p>
                <div className="space-y-4 mt-4">
                  {reviewedMatches.map((match) => (
                    <CompletedCard
                      key={match.id}
                      match={match}
                      existingHighlights={getHighlightItems(match.id)}
                      ddragonVersion={ddragonVersion}
                      onSaved={handleCompletedSaved}
                      locale={locale}
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

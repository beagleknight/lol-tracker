"use client";

import {
  Loader2,
  Save,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Link as LinkIcon,
  Eye,
  ClipboardEdit,
  ExternalLink,
  Pencil,
  X,
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

import { saveReview } from "@/app/actions/matches";
import {
  ActionItemCheckin,
  type ActionItemOutcome,
  type OutcomeValue,
} from "@/components/action-item-checkin";
import { EmptyState } from "@/components/empty-state";
import {
  HighlightsDisplay,
  type HighlightItem,
  type TopicOption,
} from "@/components/highlights-editor";
import { MarkdownTextarea } from "@/components/markdown-textarea";
import { Pagination, paginate, PAGE_SIZE } from "@/components/pagination";
import { PositionIcon, getRoleRelevance, getPositionLabel } from "@/components/position-icon";
import { ResultBadge, ResultBar } from "@/components/result-badge";
import { TopicClickGrid, type TopicToggle } from "@/components/topic-click-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth-client";
import { formatDate, formatDuration, DEFAULT_LOCALE } from "@/lib/format";
import { getKeystoneIconUrlByName, getChampionIconUrl } from "@/lib/riot-api";
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
      text: string | null;
      topicId?: number;
      topicName?: string;
    }>
  >;
  ddragonVersion: string;
  reviewedPage: number;
  reviewedTotalPages: number;
  reviewedTotal: number;
  initialTab: "pending" | "reviewed";
  topics: TopicOption[];
  activeActionItems: Array<{
    id: number;
    description: string;
    topicId: number | null;
    createdAt: Date;
  }>;
  initialMatchId?: string;
  readOnly?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Priority scoring heuristic for review ordering.
 * Higher score = more worth reviewing.
 */
function computePriorityScore(match: Match): number {
  let score = 0;
  if (match.result === "Defeat") score += 3;
  if (match.deaths > 7) score += 2;
  else if (match.deaths > 4) score += 1;
  if (match.gameDurationSeconds > 25 * 60) score += 1;
  const kda =
    match.deaths === 0 ? match.kills + match.assists : (match.kills + match.assists) / match.deaths;
  if (kda < 2) score += 2;
  else if (kda < 3) score += 1;
  return score;
}

const PRIORITY_THRESHOLD = 4;

// ─── Match Header (shared) ──────────────────────────────────────────────────

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

// ─── Pending Review Card ────────────────────────────────────────────────────
// Single-pass review: topic grid + notes + VOD URL + action item check-in

function PendingReviewCard({
  match,
  existingHighlights,
  ddragonVersion,
  onReviewed,
  locale,
  isExpanded,
  onToggleExpand,
  priorityScore,
  topics,
  activeActionItems,
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
  activeActionItems: Array<{
    id: number;
    description: string;
    topicId: number | null;
    createdAt: Date;
  }>;
}) {
  // Convert existing highlights to TopicToggle format
  const initialSelected: TopicToggle[] = existingHighlights
    .filter((h) => h.topicId != null)
    .map((h) => ({
      topicId: h.topicId!,
      topicName: h.topicName ?? "",
      type: h.type,
    }));

  const [selected, setSelected] = useState<TopicToggle[]>(initialSelected);
  const [comment, setComment] = useState(match.comment || "");
  const [vodUrl, setVodUrl] = useState(match.vodUrl || "");
  // Only show action items that existed before this match was played
  const matchActionItems = activeActionItems.filter(
    (ai) => ai.createdAt.getTime() <= match.gameDate.getTime(),
  );
  const [outcomes, setOutcomes] = useState<ActionItemOutcome[]>(
    matchActionItems.map((ai) => ({
      actionItemId: ai.id,
      description: ai.description,
      topicName: ai.topicId ? topics.find((t) => t.id === ai.topicId)?.name : undefined,
      outcome: null,
    })),
  );
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("Review");

  const handleSave = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await saveReview(match.id, {
          highlights: selected.map((s) => ({
            type: s.type,
            topicId: s.topicId,
          })),
          comment: comment || undefined,
          vodUrl: vodUrl || undefined,
          outcomes: outcomes
            .filter(
              (o): o is ActionItemOutcome & { outcome: NonNullable<OutcomeValue> } =>
                o.outcome !== null,
            )
            .map((o) => ({ actionItemId: o.actionItemId, outcome: o.outcome })),
        });
        if (result && "error" in result) {
          toast.error(result.error);
        } else {
          toast.success(t("toasts.reviewSaved"));
          onReviewed(match.id);
        }
      } catch {
        toast.error(t("toasts.failedToSaveReview"));
      }
    });
  }, [match.id, selected, comment, vodUrl, outcomes, onReviewed, t]);

  return (
    <Card className="surface-glow" data-match-id={match.id}>
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
            <Tooltip>
              <TooltipTrigger aria-label={t("sort.suggestedInfoLabel")}>
                <Badge variant="secondary" className="gap-1 text-gold">
                  <Sparkles className="h-3 w-3" />
                  {t("suggested")}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[200px] text-xs">{t("sort.suggestedTooltip")}</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Link href={`/matches/${match.id}`} aria-label={t("viewMatchDetails")}>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Topic click grid for highlights/lowlights */}
          <TopicClickGrid topics={topics} selected={selected} onChange={setSelected} />

          {/* Notes (markdown) */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("notesOptional")}
            </label>
            <MarkdownTextarea
              value={comment}
              onChange={setComment}
              placeholder={t("gameNotesPlaceholder")}
              rows={3}
            />
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

          {/* Action item check-in */}
          <ActionItemCheckin items={outcomes} onChange={setOutcomes} />

          {/* Save button */}
          <div className="flex items-center justify-end">
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Save className="mr-2 h-3 w-3" />
              )}
              {t("saveReview")}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Reviewed Card ──────────────────────────────────────────────────────────

function ReviewedCard({
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

  // Edit state
  const initialSelected: TopicToggle[] = existingHighlights
    .filter((h) => h.topicId != null)
    .map((h) => ({
      topicId: h.topicId!,
      topicName: h.topicName ?? "",
      type: h.type,
    }));
  const [selected, setSelected] = useState<TopicToggle[]>(initialSelected);
  const [comment, setComment] = useState(match.comment || "");
  const [vodUrl, setVodUrl] = useState(match.vodUrl || "");
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("Review");

  const handleSave = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await saveReview(match.id, {
          highlights: selected.map((s) => ({
            type: s.type,
            topicId: s.topicId,
          })),
          comment: comment || undefined,
          vodUrl: vodUrl || undefined,
        });
        if (result && "error" in result) {
          toast.error(result.error);
        } else {
          toast.success(t("toasts.reviewUpdated"));
          setIsEditing(false);
          onSaved();
        }
      } catch {
        toast.error(t("toasts.failedToUpdateReview"));
      }
    });
  }, [match.id, selected, comment, vodUrl, onSaved, t]);

  const handleCancel = useCallback(() => {
    setSelected(initialSelected);
    setComment(match.comment || "");
    setVodUrl(match.vodUrl || "");
    setIsEditing(false);
  }, [initialSelected, match.comment, match.vodUrl]);

  if (isEditing) {
    return (
      <Card className="surface-glow border-primary/30">
        <CardHeader className="pb-3">
          <MatchCardHeaderInfo match={match} ddragonVersion={ddragonVersion} locale={locale} />
        </CardHeader>
        <CardContent className="space-y-4">
          <TopicClickGrid topics={topics} selected={selected} onChange={setSelected} />

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">{t("notes")}</label>
            <MarkdownTextarea
              value={comment}
              onChange={setComment}
              placeholder={t("gameNotesPlaceholder")}
              rows={3}
            />
          </div>

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
              aria-label={t("editReview")}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {existingHighlights.length > 0 && (
          <HighlightsDisplay highlights={existingHighlights} compact />
        )}
        {match.comment && (
          <div className="rounded-md border border-border/50 bg-surface/30 p-2.5">
            <p className="line-clamp-2 text-xs text-muted-foreground italic">
              &ldquo;{match.comment}&rdquo;
            </p>
          </div>
        )}
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
          <span className="inline-flex items-center gap-1 text-win">
            <Eye className="h-3 w-3" />
            {t("reviewed")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Server-side pagination for Reviewed tab ────────────────────────────────

function ReviewedPagination({
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
  reviewedPage,
  reviewedTotalPages,
  reviewedTotal,
  initialTab,
  topics,
  activeActionItems,
  initialMatchId,
  readOnly,
}: ReviewClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isReadOnly = readOnly || user?.isDemoUser;
  const locale = user?.locale ?? DEFAULT_LOCALE;
  const t = useTranslations("Review");

  // Track which matches have been actioned this session (optimistic removal)
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());

  // Accordion state: only one card expanded at a time
  const [expandedId, setExpandedId] = useState<string | null>(initialMatchId ?? null);

  // Pagination state for Pending tab (client-side)
  const [pendingPage, setPendingPage] = useState(1);

  // Server-side pagination for Reviewed tab
  const [isReviewedNavigating, startReviewedTransition] = useTransition();

  // Tab state
  const tabValue = isReadOnly ? 1 : initialTab === "reviewed" ? 1 : 0;

  const handleTabChange = useCallback(
    (value: unknown) => {
      const tabMap: Record<number, string> = { 0: "pending", 1: "reviewed" };
      const tabName = typeof value === "number" ? tabMap[value] : String(value);
      if (!tabName) return;
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("tab", tabName);
      if (tabName !== "reviewed") sp.delete("reviewedPage");
      router.replace(`/review?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const navigateReviewedPage = useCallback(
    (page: number) => {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("tab", "reviewed");
      if (page > 1) sp.set("reviewedPage", String(page));
      else sp.delete("reviewedPage");
      startReviewedTransition(() => {
        router.push(`/review?${sp.toString()}`, { scroll: false });
      });
    },
    [router, searchParams],
  );

  // Sort pending matches by priority
  const [pendingSortMode, setPendingSortMode] = useState<"suggested" | "newest" | "oldest">(
    "suggested",
  );
  const { pendingMatches, priorityScores } = useMemo(() => {
    const remaining = unreviewedMatches.filter((m) => !actionedIds.has(m.id));
    const scores: Record<string, number> = {};
    for (const m of remaining) {
      scores[m.id] = computePriorityScore(m);
    }
    if (pendingSortMode === "suggested") {
      remaining.sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
    } else if (pendingSortMode === "newest") {
      remaining.sort((a, b) => b.gameDate.getTime() - a.gameDate.getTime());
    } else {
      remaining.sort((a, b) => a.gameDate.getTime() - b.gameDate.getTime());
    }
    return { pendingMatches: remaining, priorityScores: scores };
  }, [unreviewedMatches, actionedIds, pendingSortMode]);

  // Auto-expand the first card
  const hasAutoExpanded = useRef(false);
  useEffect(() => {
    if (!hasAutoExpanded.current && pendingMatches.length > 0 && expandedId === null) {
      setExpandedId(pendingMatches[0].id);
      hasAutoExpanded.current = true;
    }
  }, [pendingMatches, expandedId]);

  // Navigate to the correct page and scroll to the target match when initialMatchId is set
  const prevMatchIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!initialMatchId || pendingMatches.length === 0) return;
    // Only act when initialMatchId actually changes (handles client-side navigation)
    if (prevMatchIdRef.current === initialMatchId) return;
    prevMatchIdRef.current = initialMatchId;

    // Sync expandedId to the new target match
    setExpandedId(initialMatchId);

    const idx = pendingMatches.findIndex((m) => m.id === initialMatchId);
    if (idx === -1) return; // match not found (already reviewed or invalid)
    const targetPage = Math.ceil((idx + 1) / PAGE_SIZE);
    setPendingPage(targetPage);

    // Scroll to the card after React commits the page change
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-match-id="${initialMatchId}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }, [initialMatchId, pendingMatches]);

  const handleReviewed = useCallback(
    (matchId: string) => {
      setActionedIds((prev) => {
        const next = new Set(prev);
        next.add(matchId);
        return next;
      });
      // Auto-advance to next card
      if (expandedId === matchId) {
        const idx = pendingMatches.findIndex((m) => m.id === matchId);
        const nextMatch = pendingMatches[idx + 1];
        setExpandedId(nextMatch?.id ?? null);
      }
    },
    [expandedId, pendingMatches],
  );

  const handleReviewedSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  const originalUnreviewedCount = unreviewedMatches.length;
  const paginatedPending = paginate(pendingMatches, pendingPage);

  // Auto-correct page when items are removed
  const pendingTotalPages = Math.ceil(pendingMatches.length / 10);
  if (pendingPage > pendingTotalPages && pendingTotalPages > 0) {
    setPendingPage(pendingTotalPages);
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
          {pendingMatches.length === 0 ? (
            <p className="text-muted-foreground">{t("allCaughtUp")}</p>
          ) : (
            <p className="text-muted-foreground">
              {t("gamesWaitingForReview", { count: pendingMatches.length })}
            </p>
          )}
          {actionedIds.size > 0 && originalUnreviewedCount > 0 && (
            <p className="mt-1 text-xs text-gold">
              {t("sessionProgress", {
                done: actionedIds.size,
                total: originalUnreviewedCount,
              })}
            </p>
          )}
        </div>
      </div>

      {!isReadOnly && !user?.primaryRole && (
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

      {!isReadOnly && user?.isRiotLinked && !user?.region && (
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
          {!isReadOnly && (
            <TabsTrigger value={0}>
              <ClipboardEdit className="h-3.5 w-3.5" />
              {t("tabs.pending")}
              {pendingMatches.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                  {pendingMatches.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value={1}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("tabs.reviewed")}
            {reviewedTotal > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {reviewedTotal}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value={0}>
          <div className="space-y-4 pt-4">
            {pendingMatches.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title={t("emptyStates.noPendingTitle")}
                description={t("emptyStates.noPendingDescription")}
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{t("pendingHint")}</p>
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={pendingSortMode}
                      onValueChange={(v) =>
                        setPendingSortMode(v as "suggested" | "newest" | "oldest")
                      }
                    >
                      <SelectTrigger size="sm" className="w-[150px]" aria-label={t("sort.label")}>
                        <SelectValue placeholder={t("sort.suggested")}>
                          {(value: string) => {
                            const labels: Record<string, string> = {
                              suggested: t("sort.suggested"),
                              newest: t("sort.newestFirst"),
                              oldest: t("sort.oldestFirst"),
                            };
                            return labels[value] ?? value;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="suggested">{t("sort.suggested")}</SelectItem>
                        <SelectItem value="newest">{t("sort.newestFirst")}</SelectItem>
                        <SelectItem value="oldest">{t("sort.oldestFirst")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {paginatedPending.map((match) => (
                  <PendingReviewCard
                    key={match.id}
                    match={match}
                    existingHighlights={getHighlightItems(match.id)}
                    ddragonVersion={ddragonVersion}
                    onReviewed={handleReviewed}
                    locale={locale}
                    isExpanded={expandedId === match.id}
                    onToggleExpand={() =>
                      setExpandedId((prev) => (prev === match.id ? null : match.id))
                    }
                    priorityScore={priorityScores[match.id] ?? 0}
                    topics={topics}
                    activeActionItems={activeActionItems}
                  />
                ))}
                <Pagination
                  currentPage={pendingPage}
                  totalItems={pendingMatches.length}
                  onPageChange={setPendingPage}
                />
              </>
            )}
          </div>
        </TabsContent>

        {/* Reviewed Tab */}
        <TabsContent value={1}>
          <div className="relative space-y-4 pt-4">
            {isReviewedNavigating && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {reviewedMatches.length === 0 && reviewedTotal === 0 ? (
              <EmptyState
                icon={Eye}
                title={t("emptyStates.noReviewedTitle")}
                description={t("emptyStates.noReviewedDescription")}
              />
            ) : (
              <div className={isReviewedNavigating ? "opacity-40" : ""}>
                <p className="text-xs text-muted-foreground">
                  {t("reviewedGamesCount", { count: reviewedTotal })}
                </p>
                <div className="mt-4 space-y-4">
                  {reviewedMatches.map((match) => (
                    <ReviewedCard
                      key={match.id}
                      match={match}
                      existingHighlights={getHighlightItems(match.id)}
                      ddragonVersion={ddragonVersion}
                      onSaved={handleReviewedSaved}
                      locale={locale}
                      topics={topics}
                      readOnly={isReadOnly}
                    />
                  ))}
                </div>
                <ReviewedPagination
                  currentPage={reviewedPage}
                  totalPages={reviewedTotalPages}
                  disabled={isReviewedNavigating}
                  onPageChange={navigateReviewedPage}
                />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSyncMatches } from "@/hooks/use-sync-matches";
import {
  updateMatchComment,
  updateMatchReview,
  saveMatchHighlights,
} from "@/app/actions/matches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HighlightsEditor,
  type HighlightItem,
} from "@/components/highlights-editor";
import { toast } from "sonner";
import {
  RefreshCw,
  Search,
  MessageSquare,
  Eye,
  ChevronDown,
  Loader2,
  AlertCircle,
  ExternalLink,
  Save,
  Users,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import type { Match } from "@/db/schema";
import { getKeystoneIconUrlByName, getChampionIconUrl } from "@/lib/riot-api";

interface MatchHighlightData {
  type: "highlight" | "lowlight";
  text: string;
  topic: string | null;
}

interface MatchesClientProps {
  matches: Match[];
  ddragonVersion: string;
  isRiotLinked: boolean;
  highlightsPerMatch: Record<string, MatchHighlightData[]>;
  // Server pagination
  currentPage: number;
  totalPages: number;
  totalMatches: number;
  wins: number;
  losses: number;
  champions: string[];
  filters: {
    search: string;
    result: string;
    champion: string;
    review: string;
  };
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

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function ChampionIcon({
  championName,
  version,
  size = 28,
}: {
  championName: string;
  version: string;
  size?: number;
}) {
  return (
    <Image
      src={getChampionIconUrl(version, championName)}
      alt={championName}
      width={size}
      height={size}
      className="rounded"
    />
  );
}

// ─── URL helper ─────────────────────────────────────────────────────────────

function buildMatchesUrl(
  params: Record<string, string>,
  overrides: Record<string, string>
): string {
  const merged = { ...params, ...overrides };
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    // Omit defaults to keep URLs clean
    if (key === "page" && value === "1") continue;
    if (key === "result" && value === "all") continue;
    if (key === "champion" && value === "all") continue;
    if (key === "review" && value === "all") continue;
    if (key === "search" && value === "") continue;
    if (value) sp.set(key, value);
  }
  const qs = sp.toString();
  return `/matches${qs ? `?${qs}` : ""}`;
}

// ─── Match Card ─────────────────────────────────────────────────────────────

function MatchCard({
  match,
  ddragonVersion,
  matchHighlights,
}: {
  match: Match;
  ddragonVersion: string;
  matchHighlights: MatchHighlightData[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState(match.comment || "");
  const [reviewed, setReviewed] = useState(match.reviewed);
  const [reviewNotes, setReviewNotes] = useState(match.reviewNotes || "");
  const [showNotes, setShowNotes] = useState(false);
  const [highlights, setHighlights] = useState<HighlightItem[]>(
    matchHighlights.map((h) => ({
      type: h.type,
      text: h.text,
      topic: h.topic ?? undefined,
    }))
  );
  const [isSavingComment, startCommentTransition] = useTransition();
  const [isSavingReview, startReviewTransition] = useTransition();
  const [isSavingHighlights, startHighlightsTransition] = useTransition();

  const isWin = match.result === "Victory";
  const hasComment = !!match.comment;
  const hasReviewNotes = !!match.reviewNotes;
  const kda = match.deaths === 0
    ? "Perfect"
    : ((match.kills + match.assists) / match.deaths).toFixed(1);

  const highlightItems = matchHighlights.filter((h) => h.type === "highlight");
  const lowlightItems = matchHighlights.filter((h) => h.type === "lowlight");
  const hasHighlights = matchHighlights.length > 0;

  const saveComment = useCallback(() => {
    startCommentTransition(async () => {
      try {
        const result = await updateMatchComment(match.id, comment);
        if (result.success) toast.success("Comment saved.");
        else toast.error("Failed to save comment.");
      } catch {
        toast.error("Failed to save comment.");
      }
    });
  }, [match.id, comment]);

  const saveReview = useCallback(() => {
    startReviewTransition(async () => {
      try {
        const result = await updateMatchReview(match.id, reviewed, reviewNotes);
        if (result.success) toast.success("Review saved.");
        else toast.error("Failed to save review.");
      } catch {
        toast.error("Failed to save review.");
      }
    });
  }, [match.id, reviewed, reviewNotes]);

  const saveHighlights = useCallback(() => {
    startHighlightsTransition(async () => {
      try {
        const result = await saveMatchHighlights(match.id, highlights);
        if (result.success) toast.success("Highlights saved.");
        else toast.error("Failed to save highlights.");
      } catch {
        toast.error("Failed to save highlights.");
      }
    });
  }, [match.id, highlights]);

  // Check if highlights have changed from server data
  const highlightsChanged = JSON.stringify(
    highlights.map((h) => ({ type: h.type, text: h.text, topic: h.topic || null }))
  ) !== JSON.stringify(
    matchHighlights.map((h) => ({ type: h.type, text: h.text, topic: h.topic }))
  );

  return (
    <div
      className={`rounded-lg border bg-card transition-all ${
        isWin
          ? "border-l-[3px] border-l-green-500/60"
          : "border-l-[3px] border-l-red-500/60"
      } ${expanded ? "surface-glow" : "hover:bg-surface-elevated/50"}`}
    >
      {/* Collapsed Header — always visible */}
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Champion */}
          <ChampionIcon
            championName={match.championName}
            version={ddragonVersion}
            size={36}
          />

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">
                {match.championName}
              </span>
              <span className="text-muted-foreground text-xs">vs</span>
              {match.matchupChampionName ? (
                <div className="flex items-center gap-1">
                  <ChampionIcon
                    championName={match.matchupChampionName}
                    version={ddragonVersion}
                    size={20}
                  />
                  <span className="text-sm">
                    {match.matchupChampionName}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>

            {/* Highlights preview (collapsed) — show topic badges */}
            {!expanded && hasHighlights && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {highlightItems.map((item, i) => (
                  <span
                    key={`h-${i}`}
                    className="inline-flex items-center gap-0.5 rounded-md bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-400"
                  >
                    <ThumbsUp className="h-2.5 w-2.5" />
                    {item.topic || item.text}
                  </span>
                ))}
                {lowlightItems.map((item, i) => (
                  <span
                    key={`l-${i}`}
                    className="inline-flex items-center gap-0.5 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400"
                  >
                    <ThumbsDown className="h-2.5 w-2.5" />
                    {item.topic || item.text}
                  </span>
                ))}
              </div>
            )}

            {/* Fallback: show comment if no highlights */}
            {!expanded && !hasHighlights && hasComment && (
              <p className="text-xs text-muted-foreground italic mt-0.5 truncate max-w-md">
                &ldquo;{match.comment}&rdquo;
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-4 text-sm shrink-0">
            <span className="font-mono">
              {match.kills}/{match.deaths}/{match.assists}
              <span className="text-muted-foreground text-xs ml-1">
                ({kda})
              </span>
            </span>
            <span className="font-mono text-muted-foreground">
              {match.cs}cs
            </span>
            <span className="text-muted-foreground">
              {formatDuration(match.gameDurationSeconds)}
            </span>
          </div>

          {/* Indicators */}
          <div className="flex items-center gap-1.5 shrink-0">
            {match.duoPartnerPuuid && (
              <Users className="h-3.5 w-3.5 text-electric/70" />
            )}
            {hasComment && (
              <MessageSquare className="h-3.5 w-3.5 text-gold/70" />
            )}
            {match.reviewed && (
              <Eye className="h-3.5 w-3.5 text-green-500/70" />
            )}
            {hasReviewNotes && !match.reviewed && (
              <Eye className="h-3.5 w-3.5 text-yellow-500/70" />
            )}
          </div>

          {/* Result + Date */}
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <Badge
              variant={isWin ? "default" : "destructive"}
              className="text-xs"
            >
              {isWin ? "W" : "L"}
            </Badge>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {formatDate(match.gameDate)}
            </span>
          </div>

          {/* Expand indicator */}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-4">
          {/* Mobile stats row */}
          <div className="flex items-center gap-4 text-sm sm:hidden">
            <span className="font-mono">
              {match.kills}/{match.deaths}/{match.assists}
            </span>
            <span className="font-mono text-muted-foreground">
              {match.cs}cs ({match.csPerMin}/m)
            </span>
            <span className="text-muted-foreground">
              {formatDuration(match.gameDurationSeconds)}
            </span>
          </div>

          {/* Extra details row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span>{formatTime(match.gameDate)}</span>
            {match.runeKeystoneName && (
              <>
                <span>&middot;</span>
                <span className="inline-flex items-center gap-1">
                  {(() => {
                    const iconUrl = getKeystoneIconUrlByName(match.runeKeystoneName);
                    return iconUrl ? (
                      <Image src={iconUrl} alt="" width={14} height={14} className="rounded-sm inline" />
                    ) : null;
                  })()}
                  {match.runeKeystoneName}
                </span>
              </>
            )}
            <span>&middot;</span>
            <span>{match.cs}cs ({match.csPerMin}/m)</span>
            <span>&middot;</span>
            <span>{match.goldEarned?.toLocaleString()} gold</span>
            <span>&middot;</span>
            <span>Vision {match.visionScore}</span>
          </div>

          {/* Highlights / Lowlights Editor — primary section */}
          <div className="space-y-2">
            <HighlightsEditor
              highlights={highlights}
              onChange={setHighlights}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={saveHighlights}
                disabled={isSavingHighlights || !highlightsChanged}
                className="h-7 text-xs gap-1.5"
              >
                {isSavingHighlights ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Save Highlights
              </Button>
            </div>
          </div>

          {/* Game Notes — collapsible secondary section */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <ChevronRight
                className={`h-3 w-3 transition-transform ${showNotes ? "rotate-90" : ""}`}
              />
              <MessageSquare className="h-3 w-3" />
              Game Notes
              {hasComment && (
                <span className="text-[10px] text-gold/70 ml-1">(has notes)</span>
              )}
            </button>
            {showNotes && (
              <div className="space-y-2 pl-4">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What happened? What could you improve?"
                  rows={2}
                  className="text-sm resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={saveComment}
                    disabled={isSavingComment || comment === (match.comment || "")}
                    className="h-7 text-xs gap-1.5"
                  >
                    {isSavingComment ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    Save Notes
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Review */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Eye className="h-3 w-3" />
              VOD Review
            </label>
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                id={`reviewed-${match.id}`}
                checked={reviewed}
                onCheckedChange={(v) => setReviewed(!!v)}
              />
              <label
                htmlFor={`reviewed-${match.id}`}
                className="text-sm cursor-pointer"
              >
                Mark as reviewed
              </label>
            </div>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Takeaways from review..."
              rows={2}
              className="text-sm resize-none"
            />
            <div className="flex items-center justify-between">
              <Link href={`/matches/${match.id}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-gold hover:text-gold-light"
                >
                  <ExternalLink className="h-3 w-3" />
                  Full Details
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                onClick={saveReview}
                disabled={
                  isSavingReview ||
                  (reviewed === match.reviewed &&
                    reviewNotes === (match.reviewNotes || ""))
                }
                className="h-7 text-xs gap-1.5"
              >
                {isSavingReview ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Save Review
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Server Pagination ──────────────────────────────────────────────────────

function ServerPagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (totalPages <= 1) return null;

  // Build page numbers: first, last, current +/- 1, with ellipsis
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
        <ChevronLeft className="h-4 w-4" />
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

// ─── Main Matches Client ────────────────────────────────────────────────────

export function MatchesClient({
  matches: pageMatches,
  ddragonVersion,
  isRiotLinked,
  highlightsPerMatch,
  currentPage,
  totalPages,
  totalMatches,
  wins,
  losses,
  champions,
  filters,
}: MatchesClientProps) {
  const { isSyncing, handleSync } = useSyncMatches();
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();

  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  // Current filter params for URL building
  const currentParams: Record<string, string> = {
    search: filters.search,
    result: filters.result,
    champion: filters.champion,
    review: filters.review,
    page: String(currentPage),
  };

  function navigateWithFilter(key: string, value: string) {
    const url = buildMatchesUrl(currentParams, { [key]: value, page: "1" });
    startTransition(() => {
      router.push(url, { scroll: false });
    });
  }

  function navigateToPage(page: number) {
    const url = buildMatchesUrl(currentParams, { page: String(page) });
    startTransition(() => {
      router.push(url, { scroll: false });
    });
  }


  // Debounced search — navigate after typing stops
  const [searchValue, setSearchValue] = useState(filters.search);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const debouncedSearch = useCallback(
    (value: string) => {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        navigateWithFilter("search", value);
      }, 400);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.result, filters.champion, filters.review]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">Matches</h1>
          <p className="text-muted-foreground">
            {totalMatches} game{totalMatches !== 1 ? "s" : ""}{" "}
            &middot; {wins}W {losses}L ({winRate}%)
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={isSyncing || !isRiotLinked}
          className="shrink-0"
        >
          {isSyncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync Games
        </Button>
      </div>

      {!isRiotLinked && (
        <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-gold-light">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Link your Riot account in{" "}
            <Link href="/settings" className="underline font-medium">
              Settings
            </Link>{" "}
            to sync games.
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search champion, matchup, notes..."
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              debouncedSearch(e.target.value);
            }}
            className="pl-9"
          />
        </div>
        <Select value={filters.result} onValueChange={(v) => navigateWithFilter("result", v ?? "all")}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Result" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Results</SelectItem>
            <SelectItem value="Victory">Victories</SelectItem>
            <SelectItem value="Defeat">Defeats</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.champion} onValueChange={(v) => navigateWithFilter("champion", v ?? "all")}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Champion" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Champions</SelectItem>
            {champions.map((c) => (
              <SelectItem key={c} value={c}>
                <span className="inline-flex items-center gap-1.5">
                  <Image
                    src={getChampionIconUrl(ddragonVersion, c)}
                    alt={c}
                    width={16}
                    height={16}
                    className="rounded"
                  />
                  {c}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.review} onValueChange={(v) => navigateWithFilter("review", v ?? "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Review" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="unreviewed">Not Reviewed</SelectItem>
            <SelectItem value="has-notes">Has Notes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Match Cards */}
      {totalMatches === 0 && !isNavigating ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <p className="text-muted-foreground">
            {filters.search || filters.result !== "all" || filters.champion !== "all" || filters.review !== "all"
              ? "No matches match your filters."
              : "No matches synced yet. Click Sync Games to get started."}
          </p>
        </div>
      ) : (
        <>
          <div className="relative">
            {isNavigating && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-lg">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className={`space-y-2 transition-opacity duration-150 ${isNavigating ? "opacity-40" : ""}`}>
              {pageMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  ddragonVersion={ddragonVersion}
                  matchHighlights={highlightsPerMatch[match.id] || []}
                />
              ))}
            </div>
          </div>
          <ServerPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={navigateToPage}
            disabled={isNavigating}
          />
        </>
      )}
    </div>
  );
}

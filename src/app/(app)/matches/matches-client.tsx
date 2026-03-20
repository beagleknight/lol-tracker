"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSyncMatches } from "@/hooks/use-sync-matches";
import {
  updateMatchComment,
  updateMatchReview,
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
import { toast } from "sonner";
import {
  RefreshCw,
  Search,
  MessageSquare,
  Eye,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  ExternalLink,
  Save,
} from "lucide-react";
import type { Match } from "@/db/schema";
import { getKeystoneIconUrlByName } from "@/lib/riot-api";

interface MatchesClientProps {
  matches: Match[];
  ddragonVersion: string;
  isRiotLinked: boolean;
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
      src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championName}.png`}
      alt={championName}
      width={size}
      height={size}
      className="rounded"
    />
  );
}

// ─── Match Card ─────────────────────────────────────────────────────────────

function MatchCard({
  match,
  ddragonVersion,
}: {
  match: Match;
  ddragonVersion: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState(match.comment || "");
  const [reviewed, setReviewed] = useState(match.reviewed);
  const [reviewNotes, setReviewNotes] = useState(match.reviewNotes || "");
  const [isSavingComment, startCommentTransition] = useTransition();
  const [isSavingReview, startReviewTransition] = useTransition();

  const isWin = match.result === "Victory";
  const hasComment = !!match.comment;
  const hasReviewNotes = !!match.reviewNotes;
  const kda = match.deaths === 0
    ? "Perfect"
    : ((match.kills + match.assists) / match.deaths).toFixed(1);

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

            {/* Comment preview */}
            {hasComment && !expanded && (
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

          {/* Game Notes */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" />
              Game Notes
            </label>
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

// ─── Main Matches Client ────────────────────────────────────────────────────

export function MatchesClient({
  matches: initialMatches,
  ddragonVersion,
  isRiotLinked,
}: MatchesClientProps) {
  const { isSyncing, handleSync } = useSyncMatches();
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [reviewFilter, setReviewFilter] = useState<string>("all");

  // Unique champion names for filter
  const champions = useMemo(() => {
    const names = new Set(initialMatches.map((m) => m.championName));
    return Array.from(names).sort();
  }, [initialMatches]);

  const [championFilter, setChampionFilter] = useState<string>("all");

  // Filter matches
  const filteredMatches = useMemo(() => {
    return initialMatches.filter((m) => {
      if (resultFilter !== "all" && m.result !== resultFilter) return false;
      if (championFilter !== "all" && m.championName !== championFilter)
        return false;
      if (reviewFilter === "reviewed" && !m.reviewed) return false;
      if (reviewFilter === "unreviewed" && m.reviewed) return false;
      if (reviewFilter === "has-notes" && !m.comment) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesSearch =
          m.championName.toLowerCase().includes(q) ||
          m.matchupChampionName?.toLowerCase().includes(q) ||
          m.runeKeystoneName?.toLowerCase().includes(q) ||
          m.comment?.toLowerCase().includes(q) ||
          m.reviewNotes?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [initialMatches, resultFilter, championFilter, reviewFilter, search]);

  // Stats
  const wins = filteredMatches.filter((m) => m.result === "Victory").length;
  const losses = filteredMatches.filter((m) => m.result === "Defeat").length;
  const winRate =
    filteredMatches.length > 0
      ? Math.round((wins / filteredMatches.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">Matches</h1>
          <p className="text-muted-foreground">
            {filteredMatches.length} game{filteredMatches.length !== 1 ? "s" : ""}{" "}
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={resultFilter} onValueChange={(v) => setResultFilter(v ?? "all")}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Result" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Results</SelectItem>
            <SelectItem value="Victory">Victories</SelectItem>
            <SelectItem value="Defeat">Defeats</SelectItem>
          </SelectContent>
        </Select>
        <Select value={championFilter} onValueChange={(v) => setChampionFilter(v ?? "all")}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Champion" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Champions</SelectItem>
            {champions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reviewFilter} onValueChange={(v) => setReviewFilter(v ?? "all")}>
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
      {filteredMatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <p className="text-muted-foreground">
            {initialMatches.length === 0
              ? "No matches synced yet. Click Sync Games to get started."
              : "No matches match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              ddragonVersion={ddragonVersion}
            />
          ))}
        </div>
      )}
    </div>
  );
}

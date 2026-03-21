"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  updateMatchComment,
  updateMatchReview,
  saveMatchHighlights,
} from "@/app/actions/matches";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HighlightsEditor,
  type HighlightItem,
} from "@/components/highlights-editor";
import { toast } from "sonner";
import {
  MessageSquare,
  Eye,
  ChevronDown,
  Loader2,
  ExternalLink,
  Save,
  Users,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
} from "lucide-react";
import { getKeystoneIconUrlByName, getChampionIconUrl } from "@/lib/riot-api";
import { ChampionLink } from "@/components/champion-link";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MatchHighlightData {
  type: "highlight" | "lowlight";
  text: string;
  topic: string | null;
}

/** The minimal match shape that MatchCard needs */
export interface MatchCardData {
  id: string;
  gameDate: Date;
  result: "Victory" | "Defeat" | string;
  championName: string;
  matchupChampionName: string | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  csPerMin: number | null;
  gameDurationSeconds: number;
  goldEarned: number | null;
  visionScore: number | null;
  runeKeystoneName: string | null;
  comment: string | null;
  reviewed: boolean;
  reviewNotes: string | null;
  duoPartnerPuuid: string | null;
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
  }).format(new Date(date));
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
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

// ─── MatchCard ──────────────────────────────────────────────────────────────

export function MatchCard({
  match,
  ddragonVersion,
  matchHighlights,
}: {
  match: MatchCardData;
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
                <ChampionLink
                  champion={match.matchupChampionName}
                  ddragonVersion={ddragonVersion}
                  linkTo="scout-enemy"
                  yourChampion={match.championName}
                  iconSize={20}
                  textClassName="text-sm"
                  stopPropagation
                />
              ) : (
                <span className="text-sm text-muted-foreground">&mdash;</span>
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

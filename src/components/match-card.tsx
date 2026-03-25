"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  MessageSquare,
  Eye,
  Users,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  EyeOff,
} from "lucide-react";
import { getChampionIconUrl } from "@/lib/riot-api";
import { formatDate, formatDuration, DEFAULT_LOCALE } from "@/lib/format";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MatchHighlightData {
  type: "highlight" | "lowlight";
  text: string;
  topic: string | null;
}

/** The minimal match shape that MatchCard needs */
interface MatchCardData {
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
  reviewSkippedReason?: string | null;
  duoPartnerPuuid: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  locale = DEFAULT_LOCALE,
}: {
  match: MatchCardData;
  ddragonVersion: string;
  matchHighlights: MatchHighlightData[];
  locale?: string;
}) {
  const isWin = match.result === "Victory";
  const hasComment = !!match.comment;
  const hasReviewNotes = !!match.reviewNotes;
  const kda =
    match.deaths === 0
      ? "Perfect"
      : ((match.kills + match.assists) / match.deaths).toFixed(1);

  const highlightItems = matchHighlights.filter((h) => h.type === "highlight");
  const lowlightItems = matchHighlights.filter((h) => h.type === "lowlight");
  const hasHighlights = matchHighlights.length > 0;

  // Review status for tooltip
  const reviewStatusText = match.reviewed
    ? match.reviewSkippedReason
      ? `Skipped: ${match.reviewSkippedReason}`
      : hasReviewNotes
      ? match.reviewNotes!
      : "Reviewed"
    : "Not reviewed";

  return (
    <TooltipProvider>
      <Link
        href={`/matches/${match.id}`}
        className={`block rounded-lg border bg-card transition-all hover:bg-surface-elevated/50 ${
          isWin
            ? "border-l-[3px] border-l-green-500/60"
            : "border-l-[3px] border-l-red-500/60"
        }`}
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
              <span className="font-medium text-sm">{match.championName}</span>
              {match.matchupChampionName && (
                <>
                  <span className="text-muted-foreground text-xs">vs</span>
                  <span className="inline-flex items-center gap-1 text-sm">
                    <Image
                      src={getChampionIconUrl(
                        ddragonVersion,
                        match.matchupChampionName
                      )}
                      alt={match.matchupChampionName}
                      width={20}
                      height={20}
                      className="rounded"
                    />
                    {match.matchupChampionName}
                  </span>
                </>
              )}
              {!match.matchupChampionName && (
                <span className="text-sm text-muted-foreground">&mdash;</span>
              )}
            </div>

            {/* Highlights preview — show topic badges with tooltip for details */}
            {hasHighlights && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {highlightItems.map((item, i) => {
                  const hasText = !!(item.text && item.topic);
                  return (
                    <Tooltip key={`h-${i}`}>
                      <TooltipTrigger
                        className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] cursor-default ${
                          hasText
                            ? "bg-green-400/20 text-green-300"
                            : "bg-green-400/10 text-green-400"
                        }`}
                      >
                        <ThumbsUp className="h-2.5 w-2.5" />
                        {item.topic || item.text}
                      </TooltipTrigger>
                      {hasText && (
                        <TooltipContent side="bottom" className="max-w-sm">
                          <p className="whitespace-pre-wrap">{item.text}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
                {lowlightItems.map((item, i) => {
                  const hasText = !!(item.text && item.topic);
                  return (
                    <Tooltip key={`l-${i}`}>
                      <TooltipTrigger
                        className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] cursor-default ${
                          hasText
                            ? "bg-red-400/20 text-red-300"
                            : "bg-red-400/10 text-red-400"
                        }`}
                      >
                        <ThumbsDown className="h-2.5 w-2.5" />
                        {item.topic || item.text}
                      </TooltipTrigger>
                      {hasText && (
                        <TooltipContent side="bottom" className="max-w-sm">
                          <p className="whitespace-pre-wrap">{item.text}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>
            )}

            {/* Fallback: show comment preview if no highlights */}
            {!hasHighlights && hasComment && (
              <p className="text-xs text-muted-foreground italic mt-0.5 truncate max-w-md">
                &ldquo;{match.comment}&rdquo;
              </p>
            )}
          </div>

          {/* Stats — compact on mobile, full on sm+ */}
          <span className="sm:hidden font-mono text-xs text-muted-foreground shrink-0">
            {match.kills}/{match.deaths}/{match.assists}
          </span>
          <div className="hidden sm:flex items-center gap-4 text-sm shrink-0">
            <span className="font-mono">
              {match.kills}/{match.deaths}/{match.assists}
              <span className="text-muted-foreground text-xs ml-1">
                ({kda})
              </span>
            </span>
            <span className="font-mono text-muted-foreground">
              {match.cs} CS
            </span>
            <span className="text-muted-foreground">
              {formatDuration(match.gameDurationSeconds)}
            </span>
          </div>

          {/* Indicators with tooltips */}
          <div className="flex items-center gap-1.5 shrink-0">
            {match.duoPartnerPuuid && (
              <Tooltip>
                <TooltipTrigger className="cursor-default">
                  <Users className="h-3.5 w-3.5 text-electric/70" />
                </TooltipTrigger>
                <TooltipContent>Duo game</TooltipContent>
              </Tooltip>
            )}
            {hasComment && (
              <Tooltip>
                <TooltipTrigger className="cursor-default">
                  <MessageSquare className="h-3.5 w-3.5 text-gold/70" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm">
                  <p className="line-clamp-4 whitespace-pre-wrap">{match.comment}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {match.reviewed && (
              <Tooltip>
                <TooltipTrigger className="cursor-default">
                  <Eye className="h-3.5 w-3.5 text-green-400/70" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm">
                  <p className="line-clamp-4 whitespace-pre-wrap">{reviewStatusText}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {!match.reviewed && (hasReviewNotes || hasHighlights || hasComment) && (
              <Tooltip>
                <TooltipTrigger className="cursor-default">
                  <EyeOff className="h-3.5 w-3.5 text-yellow-500/70" />
                </TooltipTrigger>
                <TooltipContent>Has notes, not yet reviewed</TooltipContent>
              </Tooltip>
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
              {formatDate(match.gameDate, locale)}
            </span>
          </div>

          {/* Navigate indicator */}
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </Link>
    </TooltipProvider>
  );
}

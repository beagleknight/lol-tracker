"use client";

import {
  MessageSquare,
  Eye,
  Users,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  EyeOff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";

import type { MatchResult } from "@/lib/match-result";

import { ChampionLink } from "@/components/champion-link";
import { PositionIcon, getRoleRelevance, getPositionLabel } from "@/components/position-icon";
import { ResultBadge, ResultBar } from "@/components/result-badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { formatDate, formatDuration, DEFAULT_LOCALE } from "@/lib/format";
import { resultBgTint } from "@/lib/match-result";
import { getChampionIconUrl, getKeystoneIconUrlByName } from "@/lib/riot-api";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MatchHighlightData {
  type: "highlight" | "lowlight";
  text: string;
  topicName?: string | null;
}

/** The minimal match shape that MatchCard needs */
export interface MatchCardData {
  id: string;
  gameDate: Date;
  result: MatchResult;
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
  position?: string | null;
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
      unoptimized={size <= 32}
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
  variant = "default",
  showScoutLink = false,
  userPrimaryRole,
  matchBasePath = "/matches",
}: {
  match: MatchCardData;
  ddragonVersion: string;
  matchHighlights: MatchHighlightData[];
  locale?: string;
  variant?: "default" | "compact";
  showScoutLink?: boolean;
  userPrimaryRole?: string | null;
  matchBasePath?: string;
}) {
  const t = useTranslations("MatchCard");
  const isCompact = variant === "compact";
  const hasComment = !!match.comment;
  const hasReviewNotes = !!match.reviewNotes;
  const roleRelevance = getRoleRelevance(match.position, userPrimaryRole);
  const isOffRole = roleRelevance === "off-role";
  const kda =
    match.deaths === 0
      ? t("perfectKda")
      : ((match.kills + match.assists) / match.deaths).toFixed(1);

  const highlightItems = matchHighlights.filter((h) => h.type === "highlight");
  const lowlightItems = matchHighlights.filter((h) => h.type === "lowlight");
  const hasHighlights = matchHighlights.length > 0;

  // In compact mode, limit visible pills to 1 per line (highlights on line 1, lowlights on line 2)
  const maxCompactPerLine = 1;
  let visibleHighlights = highlightItems;
  let visibleLowlights = lowlightItems;
  let highlightOverflow = 0;
  let lowlightOverflow = 0;
  if (isCompact && hasHighlights) {
    visibleHighlights = highlightItems.slice(0, maxCompactPerLine);
    highlightOverflow = highlightItems.length - visibleHighlights.length;
    visibleLowlights = lowlightItems.slice(0, maxCompactPerLine);
    lowlightOverflow = lowlightItems.length - visibleLowlights.length;
  }

  // Review status for tooltip
  const reviewStatusText = match.reviewed
    ? match.reviewSkippedReason
      ? t("reviewSkipped", { reason: match.reviewSkippedReason })
      : hasReviewNotes
        ? match.reviewNotes!
        : t("reviewed")
    : t("notReviewed");

  // Position icon color based on role relevance
  const positionIconColor =
    roleRelevance === "main"
      ? "text-gold"
      : roleRelevance === "off-role"
        ? "text-warning"
        : "text-muted-foreground";

  const positionTooltipText = match.position
    ? roleRelevance === "main"
      ? t("positionMain", { position: getPositionLabel(match.position) })
      : roleRelevance === "off-role"
        ? t("positionOffRole", { position: getPositionLabel(match.position) })
        : getPositionLabel(match.position)
    : null;

  return (
    <TooltipProvider>
      <Link
        href={`${matchBasePath}/${match.id}`}
        className={`block rounded-lg border transition-all ${isOffRole ? "off-role-stripes bg-surface-elevated/50" : `hover-lift bg-card hover:bg-surface-elevated/50 ${resultBgTint(match.result)}`}`}
      >
        <div className={`flex items-center gap-3 ${isCompact ? "px-3 py-2" : "px-4 py-3"}`}>
          {/* Result bar */}
          <ResultBar result={match.result} size={isCompact ? "sm" : "md"} />

          {/* Position icon */}
          {match.position && (
            <Tooltip>
              <TooltipTrigger
                className="cursor-default"
                aria-label={positionTooltipText ?? undefined}
              >
                <PositionIcon
                  position={match.position}
                  size={isCompact ? 14 : 16}
                  className={`shrink-0 ${positionIconColor}`}
                />
              </TooltipTrigger>
              <TooltipContent>{positionTooltipText}</TooltipContent>
            </Tooltip>
          )}

          {/* Champion */}
          <ChampionIcon
            championName={match.championName}
            version={ddragonVersion}
            size={isCompact ? 32 : 36}
          />

          {/* Main info */}
          <div className="min-w-0 flex-1">
            {/* Line 1: Champion vs Opponent + compact highlight pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-medium ${isCompact ? "text-sm" : "text-sm"}`}>
                {match.championName}
              </span>
              {match.matchupChampionName ? (
                <>
                  <span className="text-xs text-muted-foreground">{t("vs")}</span>
                  {showScoutLink ? (
                    <ChampionLink
                      champion={match.matchupChampionName}
                      ddragonVersion={ddragonVersion}
                      linkTo="scout-enemy"
                      yourChampion={match.championName}
                      iconSize={isCompact ? 16 : 20}
                      textClassName={`text-muted-foreground ${isCompact ? "text-xs" : "text-sm"}`}
                      stopPropagation
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Image
                        src={getChampionIconUrl(ddragonVersion, match.matchupChampionName)}
                        alt={match.matchupChampionName}
                        width={isCompact ? 16 : 20}
                        height={isCompact ? 16 : 20}
                        unoptimized
                        className="rounded"
                      />
                      {match.matchupChampionName}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm text-muted-foreground">&mdash;</span>
              )}
              {/* Compact: highlight pills on champion line */}
              {isCompact &&
                hasHighlights &&
                visibleHighlights.map((item, i) => {
                  const hasText = !!(item.text && item.topicName);
                  return (
                    <Tooltip key={`h-${i}`}>
                      <TooltipTrigger
                        className={`inline-flex cursor-default items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] ${
                          hasText ? "bg-win/20 text-win-muted" : "bg-win/10 text-win"
                        }`}
                      >
                        <ThumbsUp className="h-2.5 w-2.5" />
                        {item.topicName || item.text}
                      </TooltipTrigger>
                      {hasText && (
                        <TooltipContent side="bottom" className="max-w-sm">
                          <p className="whitespace-pre-wrap">{item.text}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              {isCompact && hasHighlights && highlightOverflow > 0 && (
                <span className="text-[10px] text-muted-foreground">+{highlightOverflow}</span>
              )}
            </div>

            {/* Line 2 (compact): Rune · Duration · KDA · CS + lowlight pills */}
            {isCompact && (
              <div className="inline-flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {match.runeKeystoneName &&
                  (() => {
                    const iconUrl = getKeystoneIconUrlByName(match.runeKeystoneName);
                    return iconUrl ? (
                      <Image
                        src={iconUrl}
                        alt=""
                        width={12}
                        height={12}
                        unoptimized
                        className="rounded-sm"
                      />
                    ) : null;
                  })()}
                <span>
                  {match.runeKeystoneName || "\u2014"} &middot;{" "}
                  {formatDuration(match.gameDurationSeconds)} &middot;{" "}
                  <span className="font-mono">
                    {match.kills}/{match.deaths}/{match.assists}
                  </span>{" "}
                  &middot;{" "}
                  {match.csPerMin
                    ? t("csWithPerMin", { cs: match.cs, csPerMin: match.csPerMin.toFixed(1) })
                    : t("csLabel", { cs: match.cs })}
                </span>
                {hasHighlights &&
                  visibleLowlights.map((item, i) => {
                    const hasText = !!(item.text && item.topicName);
                    return (
                      <Tooltip key={`l-${i}`}>
                        <TooltipTrigger
                          className={`inline-flex cursor-default items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] ${
                            hasText ? "bg-loss/20 text-loss-muted" : "bg-loss/10 text-loss"
                          }`}
                        >
                          <ThumbsDown className="h-2.5 w-2.5" />
                          {item.topicName || item.text}
                        </TooltipTrigger>
                        {hasText && (
                          <TooltipContent side="bottom" className="max-w-sm">
                            <p className="whitespace-pre-wrap">{item.text}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
                {isCompact && hasHighlights && lowlightOverflow > 0 && (
                  <span className="text-[10px] text-muted-foreground">+{lowlightOverflow}</span>
                )}
              </div>
            )}

            {/* Highlights preview — default variant only (compact shows them inline above) */}
            {!isCompact && hasHighlights && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {highlightItems.map((item, i) => {
                  const hasText = !!(item.text && item.topicName);
                  return (
                    <Tooltip key={`h-${i}`}>
                      <TooltipTrigger
                        className={`inline-flex cursor-default items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] ${
                          hasText ? "bg-win/20 text-win-muted" : "bg-win/10 text-win"
                        }`}
                      >
                        <ThumbsUp className="h-2.5 w-2.5" />
                        {item.topicName || item.text}
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
                  const hasText = !!(item.text && item.topicName);
                  return (
                    <Tooltip key={`l-${i}`}>
                      <TooltipTrigger
                        className={`inline-flex cursor-default items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] ${
                          hasText ? "bg-loss/20 text-loss-muted" : "bg-loss/10 text-loss"
                        }`}
                      >
                        <ThumbsDown className="h-2.5 w-2.5" />
                        {item.topicName || item.text}
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

            {/* Fallback: show comment preview if no highlights (default variant only) */}
            {!isCompact && !hasHighlights && hasComment && (
              <p className="mt-0.5 max-w-md truncate text-xs text-muted-foreground italic">
                &ldquo;{match.comment}&rdquo;
              </p>
            )}
          </div>

          {/* Stats — default variant only (compact stats are inline above) */}
          {!isCompact && (
            <>
              <span className="shrink-0 font-mono text-xs text-muted-foreground sm:hidden">
                {match.kills}/{match.deaths}/{match.assists}
              </span>
              <div className="hidden shrink-0 items-center gap-4 text-sm sm:flex">
                <span className="font-mono">
                  {match.kills}/{match.deaths}/{match.assists}
                  <span className="ml-1 text-xs text-muted-foreground">({kda})</span>
                </span>
                <span className="font-mono text-muted-foreground">
                  {match.csPerMin
                    ? t("csWithPerMin", { cs: match.cs, csPerMin: match.csPerMin.toFixed(1) })
                    : t("csLabel", { cs: match.cs })}
                </span>
                <span className="text-muted-foreground">
                  {formatDuration(match.gameDurationSeconds)}
                </span>
              </div>
            </>
          )}

          {/* Indicators with tooltips (hide duo/comment/unreviewed in compact) */}
          <div className="flex shrink-0 items-center gap-1.5">
            {!isCompact && match.duoPartnerPuuid && (
              <Tooltip>
                <TooltipTrigger className="cursor-default" aria-label="Duo game">
                  <Users className="h-3.5 w-3.5 text-electric/70" />
                </TooltipTrigger>
                <TooltipContent>{t("duoGameTooltip")}</TooltipContent>
              </Tooltip>
            )}
            {!isCompact && hasComment && (
              <Tooltip>
                <TooltipTrigger className="cursor-default" aria-label="Has comment">
                  <MessageSquare className="h-3.5 w-3.5 text-gold/70" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm">
                  <p className="line-clamp-4 whitespace-pre-wrap">{match.comment}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {match.reviewed && (
              <Tooltip>
                <TooltipTrigger className="cursor-default" aria-label="Reviewed">
                  <Eye className="h-3.5 w-3.5 text-win/70" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm">
                  <p className="line-clamp-4 whitespace-pre-wrap">{reviewStatusText}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {!match.reviewed && (hasReviewNotes || hasHighlights || hasComment) && (
              <Tooltip>
                <TooltipTrigger className="cursor-default" aria-label="Not reviewed">
                  <EyeOff className="h-3.5 w-3.5 text-warning/70" />
                </TooltipTrigger>
                <TooltipContent>{t("hasNotesNotReviewed")}</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Result badge */}
          <ResultBadge result={match.result} className={isCompact ? "w-6 justify-center" : ""} />

          {/* Date — default variant only */}
          {!isCompact && (
            <span className="shrink-0 text-[10px] whitespace-nowrap text-muted-foreground">
              {formatDate(match.gameDate, locale)}
            </span>
          )}

          {/* Navigate indicator — default variant only */}
          {!isCompact && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </div>
      </Link>
    </TooltipProvider>
  );
}

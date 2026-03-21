"use client";

import { useState, useTransition, useCallback, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  detectLiveMatchup,
  getMatchupReport,
  type LiveMatchupResult,
  type MatchupReport,
  type RecentUnreviewedMatch,
} from "@/app/actions/live";
import {
  savePostGameReview,
} from "@/app/actions/matches";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ChampionCombobox, type ChampionRecommendations } from "@/components/champion-combobox";
import type { ChampionPickCount } from "@/app/actions/live";
import {
  HighlightsEditor,
  type HighlightItem,
} from "@/components/highlights-editor";
import { SKIP_REVIEW_REASONS } from "@/lib/topics";
import { toast } from "sonner";
import { MatchCard } from "@/components/match-card";
import {
  Crosshair,
  Swords,
  Clock,
  MessageSquare,
  Save,
  Loader2,
  AlertCircle,
  Gamepad2,
  TrendingUp,
  BarChart3,
  SkipForward,
  ChevronDown,
  Link as LinkIcon,
  Users,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { getKeystoneIconUrlByName, getChampionIconUrl } from "@/lib/riot-api";

// ─── Helpers ────────────────────────────────────────────────────────────────

function ChampionIcon({
  championName,
  version,
  size = 36,
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

function ItemIcon({
  itemId,
  version,
  size = 24,
}: {
  itemId: number;
  version: string;
  size?: number;
}) {
  if (itemId === 0) {
    return (
      <div
        className="rounded bg-surface/50 border border-border/30"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <Image
      src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`}
      alt={`Item ${itemId}`}
      width={size}
      height={size}
      className="rounded"
    />
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface ScoutClientProps {
  ddragonVersion: string;
  allChampions: string[];
  recentUnreviewed: RecentUnreviewedMatch | null;
  isRiotLinked: boolean;
  initialYourChampion?: string;
  initialEnemyChampion?: string;
  mostPlayed?: ChampionPickCount[];
  mostFaced?: ChampionPickCount[];
}

// ─── Post-Game Review Card ──────────────────────────────────────────────────

function PostGameReviewCard({
  match,
  ddragonVersion,
}: {
  match: RecentUnreviewedMatch;
  ddragonVersion: string;
}) {
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [vodUrl, setVodUrl] = useState("");
  const [isSaving, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [showSkipMenu, setShowSkipMenu] = useState(false);

  const isWin = match.result === "Victory";
  const kda =
    match.deaths === 0
      ? "Perfect"
      : ((match.kills + match.assists) / match.deaths).toFixed(1);

  const hasContent =
    highlights.length > 0 || comment.trim() || vodUrl.trim();

  const handleSave = useCallback(
    (skipReason?: string) => {
      startTransition(async () => {
        try {
          const result = await savePostGameReview(match.matchId, {
            highlights,
            comment: comment || undefined,
            vodUrl: vodUrl || undefined,
            reviewed: !!skipReason,
            reviewSkippedReason: skipReason,
          });
          if (!result.success) {
            toast.error("Failed to save review.");
            return;
          }
          toast.success(
            skipReason
              ? "Review saved & VOD review skipped."
              : "Post-game review saved!"
          );
          setSaved(true);
        } catch {
          toast.error("Failed to save review.");
        }
      });
    },
    [match.matchId, highlights, comment, vodUrl]
  );

  if (saved) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-center">
        <p className="text-sm text-green-400">Review saved for your latest game.</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border-2 p-4 space-y-4 surface-glow ${
        isWin ? "border-green-500/40" : "border-red-500/40"
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-gold">
        <Clock className="h-4 w-4" />
        Post-Game Review — {timeAgo(match.gameDate)}
      </div>

      {/* Match summary row */}
      <div className="flex items-center gap-3">
        <ChampionIcon
          championName={match.championName}
          version={ddragonVersion}
          size={44}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{match.championName}</span>
            {match.matchupChampionName && (
              <>
                <span className="text-muted-foreground text-xs">vs</span>
                <ChampionIcon
                  championName={match.matchupChampionName}
                  version={ddragonVersion}
                  size={24}
                />
                <span className="text-sm">{match.matchupChampionName}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
            <span className="font-mono">
              {match.kills}/{match.deaths}/{match.assists}{" "}
              <span className="text-xs">({kda})</span>
            </span>
            {match.runeKeystoneName && (
              <>
                <span>&middot;</span>
                {(() => {
                  const url = getKeystoneIconUrlByName(match.runeKeystoneName);
                  return url ? (
                    <Image src={url} alt={match.runeKeystoneName} width={16} height={16} className="inline rounded" />
                  ) : null;
                })()}
                <span>{match.runeKeystoneName}</span>
              </>
            )}
            <span>&middot;</span>
            <span>{formatDuration(match.gameDurationSeconds)}</span>
          </div>
        </div>
        <Badge variant={isWin ? "default" : "destructive"}>
          {match.result}
        </Badge>
      </div>

      {/* Items */}
      <div className="flex gap-1">
        {match.items.map((itemId, i) => (
          <ItemIcon key={i} itemId={itemId} version={ddragonVersion} size={28} />
        ))}
      </div>

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
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSkipMenu(!showSkipMenu)}
            disabled={isSaving || !hasContent}
            className="gap-1.5"
          >
            <SkipForward className="h-4 w-4" />
            Save & Skip VOD
          </Button>
          {showSkipMenu && (
            <div className="absolute bottom-full right-0 mb-1 w-56 rounded-md border bg-popover p-1 shadow-md z-10">
              {SKIP_REVIEW_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => {
                    setShowSkipMenu(false);
                    handleSave(reason);
                  }}
                  className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  {reason}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Save (without marking as reviewed) */}
        <Button
          onClick={() => handleSave()}
          disabled={isSaving || !hasContent}
          className="gap-1.5"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Review
        </Button>
      </div>
    </div>
  );
}

// ─── Scouting Report ────────────────────────────────────────────────────────

function ScoutingReport({
  report,
  ddragonVersion,
}: {
  report: MatchupReport;
  ddragonVersion: string;
}) {
  const { record, runeBreakdown, avgStats, overallAvgStats, duoPairs, games } = report;

  // Compute matchup KDA ratio for comparison
  const matchupKdaRatio =
    avgStats.deaths === 0
      ? 0
      : Math.round(((avgStats.kills + avgStats.assists) / avgStats.deaths) * 10) / 10;
  const overallKdaRatio =
    overallAvgStats.deaths === 0
      ? 0
      : Math.round(((overallAvgStats.kills + overallAvgStats.assists) / overallAvgStats.deaths) * 10) / 10;

  return (
    <div className="space-y-6">
      {/* Header: Record summary */}
      <div className="flex items-center gap-4">
        <ChampionIcon
          championName={report.matchupChampionName}
          version={ddragonVersion}
          size={56}
        />
        <div>
          <h2 className="text-xl font-bold">vs {report.matchupChampionName}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-lg font-mono">
              <span className="text-green-400">{record.wins}W</span>{" "}
              <span className="text-red-400">{record.losses}L</span>
            </span>
            <Badge
              variant={record.winRate >= 50 ? "default" : "destructive"}
              className="text-sm"
            >
              {record.winRate}%
            </Badge>
          </div>
          {report.lastPlayed && (
            <p className="text-xs text-muted-foreground mt-1">
              Last played: {formatDate(report.lastPlayed)}
            </p>
          )}
        </div>
      </div>

      <Separator />

      {/* Rune Performance */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-neon-purple" />
          Rune Performance
        </h3>
        {runeBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rune data.</p>
        ) : (
          <div className="space-y-2">
            {runeBreakdown.map((rune) => (
              <div key={rune.keystoneName} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    {(() => {
                      const url = getKeystoneIconUrlByName(rune.keystoneName);
                      return url ? (
                        <Image src={url} alt={rune.keystoneName} width={18} height={18} className="rounded" />
                      ) : null;
                    })()}
                    {rune.keystoneName}
                  </span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {rune.wins}W {rune.losses}L ({rune.winRate}%) &middot;{" "}
                    {rune.games} game{rune.games !== 1 ? "s" : ""}
                  </span>
                </div>
                <Progress
                  value={rune.winRate}
                  className="h-2"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Avg Stats with comparison */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-electric" />
            Average Stats
          </h3>
          {overallAvgStats.games > 0 && (
            <span className="text-[10px] text-muted-foreground">
              vs your avg ({overallAvgStats.games} games)
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <StatCell
            label="KDA"
            value={`${avgStats.kills}/${avgStats.deaths}/${avgStats.assists}`}
          />
          <StatCell
            label="CS/min"
            value={String(avgStats.csPerMin)}
            baseline={{ matchup: avgStats.csPerMin, overall: overallAvgStats.csPerMin }}
          />
          <StatCell
            label="Gold"
            value={avgStats.goldEarned.toLocaleString()}
            baseline={{ matchup: avgStats.goldEarned, overall: overallAvgStats.goldEarned }}
          />
          <StatCell
            label="Vision"
            value={String(avgStats.visionScore)}
            baseline={{ matchup: avgStats.visionScore, overall: overallAvgStats.visionScore }}
          />
          <StatCell
            label="KDA Ratio"
            value={avgStats.deaths === 0 ? "Perfect" : String(matchupKdaRatio)}
            baseline={{ matchup: matchupKdaRatio, overall: overallKdaRatio }}
          />
          <StatCell label="Games" value={String(record.total)} />
        </div>
      </div>

      {/* Duo Pairs in this matchup */}
      {duoPairs.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-electric" />
              Duo Pairs in this Matchup
            </h3>
            <div className="space-y-2">
              {duoPairs.map((pair) => (
                <div
                  key={`${pair.yourChampion}-${pair.duoChampion}`}
                  className="flex items-center gap-3 rounded-lg border border-border/50 p-2 bg-surface-elevated"
                >
                  <div className="flex items-center gap-1">
                    <ChampionIcon
                      championName={pair.yourChampion}
                      version={ddragonVersion}
                      size={28}
                    />
                    <span className="text-xs text-muted-foreground mx-1">+</span>
                    <ChampionIcon
                      championName={pair.duoChampion}
                      version={ddragonVersion}
                      size={28}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">
                      {pair.yourChampion} + {pair.duoChampion}
                    </span>
                  </div>
                  <div className="text-right text-sm">
                    <span
                      className={`font-bold ${
                        pair.winRate >= 50
                          ? "text-emerald-500"
                          : "text-red-400"
                      }`}
                    >
                      {pair.winRate}%
                    </span>
                    <span className="text-muted-foreground ml-1.5">
                      {pair.wins}W {pair.losses}L
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Past Games — using shared MatchCard */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Swords className="h-4 w-4 text-gold" />
          Past Games ({games.length})
        </h3>
        <div className="space-y-2">
          {games.map((game) => (
            <MatchCard
              key={game.matchId}
              match={{
                id: game.matchId,
                gameDate: game.gameDate,
                result: game.result,
                championName: game.championName,
                matchupChampionName: game.matchupChampionName,
                kills: game.kills,
                deaths: game.deaths,
                assists: game.assists,
                cs: game.cs,
                csPerMin: game.csPerMin,
                gameDurationSeconds: game.gameDurationSeconds,
                goldEarned: game.goldEarned,
                visionScore: game.visionScore,
                runeKeystoneName: game.runeKeystoneName,
                comment: game.comment,
                reviewed: game.reviewed,
                reviewNotes: game.reviewNotes,
                duoPartnerPuuid: game.duoPartnerPuuid,
              }}
              ddragonVersion={ddragonVersion}
              matchHighlights={game.highlights.map((h) => ({
                type: h.type,
                text: h.text,
                topic: h.topic,
              }))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  baseline,
  invertColor,
}: {
  label: string;
  value: string;
  baseline?: { matchup: number; overall: number };
  invertColor?: boolean; // true for stats where lower is better (e.g. deaths)
}) {
  let delta: number | null = null;
  let deltaLabel = "";
  if (baseline && baseline.overall > 0) {
    delta = Math.round((baseline.matchup - baseline.overall) * 10) / 10;
    const sign = delta > 0 ? "+" : "";
    deltaLabel = `${sign}${delta}`;
  }

  const isPositive = delta !== null && (invertColor ? delta < 0 : delta > 0);
  const isNegative = delta !== null && (invertColor ? delta > 0 : delta < 0);

  return (
    <div className="rounded-lg border bg-surface/30 p-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-mono font-medium mt-0.5">{value}</p>
      {delta !== null && delta !== 0 && (
        <p
          className={`text-[10px] font-mono mt-0.5 flex items-center justify-center gap-0.5 ${
            isPositive
              ? "text-green-400"
              : isNegative
              ? "text-red-400"
              : "text-muted-foreground"
          }`}
        >
          {isPositive ? (
            <ArrowUp className="h-2.5 w-2.5" />
          ) : isNegative ? (
            <ArrowDown className="h-2.5 w-2.5" />
          ) : null}
          {deltaLabel}
        </p>
      )}
      {delta === 0 && (
        <p className="text-[10px] font-mono mt-0.5 text-muted-foreground">
          avg
        </p>
      )}
    </div>
  );
}

// ─── Main Scout Client ──────────────────────────────────────────────────────

export function ScoutClient({
  ddragonVersion,
  allChampions,
  recentUnreviewed,
  isRiotLinked,
  initialYourChampion = "",
  initialEnemyChampion = "",
  mostPlayed = [],
  mostFaced = [],
}: ScoutClientProps) {
  const [yourChampion, setYourChampion] = useState<string>(initialYourChampion);
  const [enemyChampion, setEnemyChampion] = useState<string>(initialEnemyChampion);
  const [report, setReport] = useState<MatchupReport | null>(null);
  const [isLoadingReport, startReportTransition] = useTransition();
  const [isCheckingGame, startCheckTransition] = useTransition();
  const [liveResult, setLiveResult] = useState<LiveMatchupResult | null>(null);

  // Build recommendation groups for comboboxes
  const yourChampionRecs: ChampionRecommendations[] = useMemo(
    () =>
      mostPlayed.length > 0
        ? [{ heading: "Most Played", champions: mostPlayed }]
        : [],
    [mostPlayed]
  );

  const enemyChampionRecs: ChampionRecommendations[] = useMemo(
    () =>
      mostFaced.length > 0
        ? [{ heading: "Common Matchups", champions: mostFaced }]
        : [],
    [mostFaced]
  );

  const loadReport = useCallback(
    (enemy: string, yours?: string) => {
      if (!enemy) {
        setReport(null);
        return;
      }
      startReportTransition(async () => {
        try {
          const result = await getMatchupReport(enemy, yours || undefined);
          setReport(result);
        } catch {
          toast.error("Failed to load matchup report.");
        }
      });
    },
    []
  );

  // Auto-load report if initial champions are provided via URL params
  useEffect(() => {
    if (initialEnemyChampion) {
      loadReport(initialEnemyChampion, initialYourChampion || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnemyChange = useCallback(
    (value: string) => {
      setEnemyChampion(value);
      loadReport(value, yourChampion);
    },
    [yourChampion, loadReport]
  );

  const handleYourChampionChange = useCallback(
    (value: string) => {
      setYourChampion(value);
      if (enemyChampion) {
        loadReport(enemyChampion, value);
      }
    },
    [enemyChampion, loadReport]
  );

  const handleCheckGame = useCallback(() => {
    startCheckTransition(async () => {
      try {
        const result = await detectLiveMatchup();
        setLiveResult(result);

        if (result.error) {
          toast.error(result.error);
        } else if (!result.inGame) {
          toast.info("Not currently in a game.");
        } else {
          toast.success(
            `In game! Playing ${result.userChampionName || "Unknown"}.`
          );
          // Auto-set your champion
          if (result.userChampionName) {
            setYourChampion(result.userChampionName);
          }
        }
      } catch {
        toast.error("Failed to detect live game.");
      }
    });
  }, []);

  const handleEnemyQuickSelect = useCallback(
    (championName: string) => {
      setEnemyChampion(championName);
      loadReport(championName, yourChampion);
    },
    [yourChampion, loadReport]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient-gold flex items-center gap-2">
          <Crosshair className="h-6 w-6" />
          Matchup Scout
        </h1>
        <p className="text-muted-foreground">
          Pre-game scouting report &amp; post-game review tool.
        </p>
      </div>

      {/* Post-game review banner (if recent unreviewed match exists) */}
      {recentUnreviewed && (
        <PostGameReviewCard
          match={recentUnreviewed}
          ddragonVersion={ddragonVersion}
        />
      )}

      {/* Controls: two champion pickers + check game */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
        <ChampionCombobox
          value={yourChampion}
          onValueChange={handleYourChampionChange}
          champions={allChampions}
          ddragonVersion={ddragonVersion}
          placeholder="Any champion"
          label="Your Champion"
          className="flex-1 sm:max-w-xs"
          recommendations={yourChampionRecs}
        />
        <span className="hidden sm:flex items-end pb-2 text-muted-foreground font-medium">
          vs
        </span>
        <ChampionCombobox
          value={enemyChampion}
          onValueChange={handleEnemyChange}
          champions={allChampions}
          ddragonVersion={ddragonVersion}
          placeholder="Select enemy..."
          label="Enemy Champion"
          className="flex-1 sm:max-w-xs"
          recommendations={enemyChampionRecs}
        />

        {isRiotLinked && (
          <Button
            variant="outline"
            onClick={handleCheckGame}
            disabled={isCheckingGame}
            className="gap-2 shrink-0 sm:mb-0"
          >
            {isCheckingGame ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Gamepad2 className="h-4 w-4" />
            )}
            Check Game
          </Button>
        )}
      </div>

      {/* Live game detection result */}
      {liveResult && liveResult.inGame && (
        <div className="rounded-lg border border-electric/30 bg-electric/5 p-4 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Gamepad2 className="h-4 w-4 text-electric shrink-0" />
            <div>
              <span className="text-electric-light font-medium">In Game!</span>{" "}
              Playing{" "}
              {liveResult.userChampionName && (
                <span className="font-medium inline-flex items-center gap-1">
                  <Image
                    src={getChampionIconUrl(ddragonVersion, liveResult.userChampionName)}
                    alt={liveResult.userChampionName}
                    width={20}
                    height={20}
                    className="rounded"
                  />
                  {liveResult.userChampionName}
                </span>
              )}
              {liveResult.gameQueueId === 420 ? (
                <span className="text-muted-foreground"> (Ranked Solo/Duo)</span>
              ) : (
                <span className="text-muted-foreground">
                  {" "}
                  (Queue {liveResult.gameQueueId})
                </span>
              )}
            </div>
          </div>

          {/* Enemy team quick-select */}
          {liveResult.enemyTeam.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Select your lane opponent:
              </p>
              <div className="flex flex-wrap gap-2">
                {liveResult.enemyTeam.map((enemy) => (
                  <button
                    key={enemy.championId}
                    onClick={() => handleEnemyQuickSelect(enemy.championName)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-surface-elevated ${
                      enemyChampion === enemy.championName
                        ? "border-electric bg-electric/10 text-electric-light"
                        : "border-border/50"
                    }`}
                  >
                    <Image
                      src={getChampionIconUrl(ddragonVersion, enemy.championName)}
                      alt={enemy.championName}
                      width={24}
                      height={24}
                      className="rounded"
                    />
                    {enemy.championName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {liveResult && !liveResult.inGame && !liveResult.error && (
        <div className="rounded-lg border border-border/50 bg-surface/30 p-3 flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Not currently in a game. Select an opponent from the dropdowns to review
          past matchup data.
        </div>
      )}

      {!isRiotLinked && (
        <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-gold-light">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Link your Riot account in Settings to use live game detection.
        </div>
      )}

      {/* Loading state */}
      {isLoadingReport && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
          <span className="ml-2 text-muted-foreground">Loading report...</span>
        </div>
      )}

      {/* Scouting report */}
      {!isLoadingReport && report && (
        <ScoutingReport report={report} ddragonVersion={ddragonVersion} />
      )}

      {/* No historical data state */}
      {!isLoadingReport && !report && enemyChampion && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <Swords className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">
            No past games found{yourChampion ? ` as ${yourChampion}` : ""} against{" "}
            {enemyChampion}.
          </p>
          {yourChampion && (
            <p className="text-sm text-muted-foreground mt-1">
              Try clearing the &quot;Your Champion&quot; filter to see all games
              against this matchup.
            </p>
          )}
        </div>
      )}

      {/* Initial state — no matchup selected */}
      {!enemyChampion && !recentUnreviewed && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Crosshair className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">
            Select an enemy champion above to view your scouting report,
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            or click <strong>Check Game</strong> to detect a live match.
          </p>
        </div>
      )}
    </div>
  );
}

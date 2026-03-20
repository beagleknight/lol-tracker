"use client";

import { useState, useTransition, useCallback } from "react";
import Image from "next/image";
import {
  detectLiveMatchup,
  getMatchupReport,
  type LiveMatchupResult,
  type MatchupReport,
  type RecentUnreviewedMatch,
} from "@/app/actions/live";
import {
  updateMatchComment,
  updateMatchReview,
} from "@/app/actions/matches";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Crosshair,
  Swords,
  Clock,
  MessageSquare,
  Eye,
  Save,
  Loader2,
  AlertCircle,
  Gamepad2,
  TrendingUp,
  BarChart3,
  ScrollText,
} from "lucide-react";

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
      src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championName}.png`}
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
  matchupChampions: string[];
  recentUnreviewed: RecentUnreviewedMatch | null;
  isRiotLinked: boolean;
}

// ─── Post-Game Review Card ──────────────────────────────────────────────────

function PostGameReviewCard({
  match,
  ddragonVersion,
}: {
  match: RecentUnreviewedMatch;
  ddragonVersion: string;
}) {
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSaving, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const isWin = match.result === "Victory";
  const kda =
    match.deaths === 0
      ? "Perfect"
      : ((match.kills + match.assists) / match.deaths).toFixed(1);

  const handleSave = useCallback(() => {
    startTransition(async () => {
      if (comment) {
        await updateMatchComment(match.matchId, comment);
      }
      if (reviewed || reviewNotes) {
        await updateMatchReview(match.matchId, reviewed, reviewNotes);
      }
      toast.success("Post-game review saved!");
      setSaved(true);
    });
  }, [match.matchId, comment, reviewed, reviewNotes]);

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
      </div>

      {/* VOD Review */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Eye className="h-3 w-3" />
          VOD Review
        </label>
        <div className="flex items-center gap-2 mb-2">
          <Checkbox
            id="post-game-reviewed"
            checked={reviewed}
            onCheckedChange={(v) => setReviewed(!!v)}
          />
          <label htmlFor="post-game-reviewed" className="text-sm cursor-pointer">
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
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving || (!comment && !reviewed && !reviewNotes)}
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
  const { record, runeBreakdown, avgStats, games } = report;

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
                  <span>{rune.keystoneName}</span>
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

      {/* Avg Stats */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-electric" />
          Average Stats
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <StatCell label="KDA" value={`${avgStats.kills}/${avgStats.deaths}/${avgStats.assists}`} />
          <StatCell label="CS/min" value={String(avgStats.csPerMin)} />
          <StatCell label="Gold" value={avgStats.goldEarned.toLocaleString()} />
          <StatCell label="Vision" value={String(avgStats.visionScore)} />
          <StatCell
            label="KDA Ratio"
            value={
              avgStats.deaths === 0
                ? "Perfect"
                : ((avgStats.kills + avgStats.assists) / avgStats.deaths).toFixed(1)
            }
          />
          <StatCell label="Games" value={String(record.total)} />
        </div>
      </div>

      <Separator />

      {/* Notes from past games */}
      {games.some((g) => g.comment) && (
        <>
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-gold" />
              Your Notes
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {games
                .filter((g) => g.comment)
                .map((g) => (
                  <div
                    key={g.matchId}
                    className="rounded border border-border/50 bg-surface/30 p-3 text-sm"
                  >
                    <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                      <Badge
                        variant={g.result === "Victory" ? "default" : "destructive"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {g.result === "Victory" ? "W" : "L"}
                      </Badge>
                      <span>{formatDate(g.gameDate)}</span>
                      <span>&middot;</span>
                      <span className="font-mono">
                        {g.kills}/{g.deaths}/{g.assists}
                      </span>
                      {g.runeKeystoneName && (
                        <>
                          <span>&middot;</span>
                          <span>{g.runeKeystoneName}</span>
                        </>
                      )}
                    </div>
                    <p className="text-muted-foreground italic">
                      &ldquo;{g.comment}&rdquo;
                    </p>
                  </div>
                ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Past Games */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Swords className="h-4 w-4 text-gold" />
          Past Games ({games.length})
        </h3>
        <div className="space-y-2">
          {games.map((game) => (
            <PastGameCard
              key={game.matchId}
              game={game}
              ddragonVersion={ddragonVersion}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-surface/30 p-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-mono font-medium mt-0.5">{value}</p>
    </div>
  );
}

function PastGameCard({
  game,
  ddragonVersion,
}: {
  game: MatchupReport["games"][number];
  ddragonVersion: string;
}) {
  const isWin = game.result === "Victory";
  const kda =
    game.deaths === 0
      ? "Perfect"
      : ((game.kills + game.assists) / game.deaths).toFixed(1);

  return (
    <div
      className={`rounded-lg border p-3 ${
        isWin
          ? "border-l-[3px] border-l-green-500/60"
          : "border-l-[3px] border-l-red-500/60"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Champion icon */}
        <ChampionIcon
          championName={game.championName}
          version={ddragonVersion}
          size={32}
        />

        {/* Stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm">
              {game.kills}/{game.deaths}/{game.assists}
              <span className="text-muted-foreground text-xs ml-1">({kda})</span>
            </span>
            {game.runeKeystoneName && (
              <span className="text-xs text-muted-foreground">
                {game.runeKeystoneName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>{game.cs}cs ({game.csPerMin}/m)</span>
            <span>&middot;</span>
            <span>{game.goldEarned.toLocaleString()}g</span>
            <span>&middot;</span>
            <span>{formatDuration(game.gameDurationSeconds)}</span>
          </div>
        </div>

        {/* Items */}
        <div className="hidden sm:flex gap-0.5 shrink-0">
          {game.items.map((itemId, i) => (
            <ItemIcon key={i} itemId={itemId} version={ddragonVersion} size={22} />
          ))}
        </div>

        {/* Result + Date */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <Badge variant={isWin ? "default" : "destructive"} className="text-xs">
            {isWin ? "W" : "L"}
          </Badge>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {formatDate(game.gameDate)}
          </span>
        </div>
      </div>

      {/* Comment preview */}
      {game.comment && (
        <p className="text-xs text-muted-foreground italic mt-2 truncate">
          &ldquo;{game.comment}&rdquo;
        </p>
      )}

      {/* Items on mobile */}
      <div className="flex gap-0.5 mt-2 sm:hidden">
        {game.items.map((itemId, i) => (
          <ItemIcon key={i} itemId={itemId} version={ddragonVersion} size={22} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Scout Client ──────────────────────────────────────────────────────

export function ScoutClient({
  ddragonVersion,
  matchupChampions,
  recentUnreviewed,
  isRiotLinked,
}: ScoutClientProps) {
  const [selectedMatchup, setSelectedMatchup] = useState<string>("");
  const [report, setReport] = useState<MatchupReport | null>(null);
  const [isLoadingReport, startReportTransition] = useTransition();
  const [isCheckingGame, startCheckTransition] = useTransition();
  const [liveResult, setLiveResult] = useState<LiveMatchupResult | null>(null);

  const handleMatchupChange = useCallback(
    (value: string | null) => {
      const v = value ?? "";
      setSelectedMatchup(v);
      if (v) {
        startReportTransition(async () => {
          const result = await getMatchupReport(v);
          setReport(result);
        });
      } else {
        setReport(null);
      }
    },
    []
  );

  const handleCheckGame = useCallback(() => {
    startCheckTransition(async () => {
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
        // Note: Spectator API doesn't provide lane assignments,
        // so the user still needs to manually pick the matchup.
      }
    });
  }, []);

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

      {/* Controls: matchup picker + check game */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Select
          value={selectedMatchup}
          onValueChange={handleMatchupChange}
        >
          <SelectTrigger className="flex-1 sm:max-w-xs">
            <SelectValue placeholder="Select opponent champion..." />
          </SelectTrigger>
          <SelectContent>
            {matchupChampions.map((name) => (
              <SelectItem key={name} value={name}>
                <span className="flex items-center gap-2">
                  <Image
                    src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${name}.png`}
                    alt={name}
                    width={20}
                    height={20}
                    className="rounded"
                  />
                  {name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isRiotLinked && (
          <Button
            variant="outline"
            onClick={handleCheckGame}
            disabled={isCheckingGame}
            className="gap-2 shrink-0"
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
        <div className="rounded-lg border border-electric/30 bg-electric/5 p-3 flex items-center gap-3 text-sm">
          <Gamepad2 className="h-4 w-4 text-electric shrink-0" />
          <div>
            <span className="text-electric-light font-medium">In Game!</span>{" "}
            Playing{" "}
            {liveResult.userChampionName && (
              <span className="font-medium">{liveResult.userChampionName}</span>
            )}
            {liveResult.gameQueueId === 420 ? (
              <span className="text-muted-foreground"> (Ranked Solo/Duo)</span>
            ) : (
              <span className="text-muted-foreground">
                {" "}
                (Queue {liveResult.gameQueueId})
              </span>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              Select your lane opponent from the dropdown above to load the
              scouting report.
            </p>
          </div>
        </div>
      )}

      {liveResult && !liveResult.inGame && !liveResult.error && (
        <div className="rounded-lg border border-border/50 bg-surface/30 p-3 flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Not currently in a game. Select an opponent from the dropdown to review
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

      {/* Empty state */}
      {!isLoadingReport && !report && selectedMatchup && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <Swords className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">
            No games found against {selectedMatchup}.
          </p>
        </div>
      )}

      {/* Initial state — no matchup selected */}
      {!selectedMatchup && !recentUnreviewed && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Crosshair className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">
            Select an opponent champion above to view your scouting report,
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            or click <strong>Check Game</strong> to detect a live match.
          </p>
        </div>
      )}
    </div>
  );
}

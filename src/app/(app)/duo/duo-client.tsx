"use client";

import { useState, useMemo, useTransition } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import { formatDate, formatDuration, DEFAULT_LOCALE } from "@/lib/format";
import {
  Users,
  Trophy,
  Swords,
  TrendingUp,
  TrendingDown,
  Settings,
  Loader2,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { getChampionIconUrl } from "@/lib/riot-api";
import { ChampionLink } from "@/components/champion-link";
import { getDuoGames, backfillDuoGames } from "@/app/actions/duo";
import type {
  DuoStats,
  DuoGameRow,
  ChampionSynergy,
} from "@/app/actions/duo";

const PAGE_SIZE = 10;

// ─── Shared helpers ──────────────────────────────────────────────────────────

function ChampionIcon({
  championName,
  version,
  size = 32,
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

// ─── DuoHeader ───────────────────────────────────────────────────────────────

export function DuoHeader({ partnerName }: { partnerName: string | null }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">
        Duo Partner
      </h1>
      <p className="text-muted-foreground">
        {partnerName ? (
          <>
            Your performance with{" "}
            <span className="text-gold font-medium">{partnerName}</span>
          </>
        ) : (
          "Track your performance when playing with your duo partner."
        )}
      </p>
    </div>
  );
}

// ─── DuoNoPartner ────────────────────────────────────────────────────────────

export function DuoNoPartner() {
  return (
    <Card className="surface-glow">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Duo Partner Set</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          Configure your duo partner in Settings to start tracking your
          shared games, win rates, and champion synergies.
        </p>
        <Link href="/settings">
          <Button>
            <Settings className="mr-2 h-4 w-4" />
            Go to Settings
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── DuoNoGames ──────────────────────────────────────────────────────────────

export function DuoNoGames() {
  const [isBackfilling, startBackfill] = useTransition();

  return (
    <Card className="surface-glow">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Swords className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Duo Games Found</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          Your synced matches haven&apos;t been scanned for duo games yet.
          Scan your existing matches or sync new games to get started.
        </p>
        <div className="flex gap-3">
          <Button
            disabled={isBackfilling}
            onClick={() => {
              startBackfill(async () => {
                const result = await backfillDuoGames();
                if (result.duoFound > 0) {
                  toast.success(
                    `Found ${result.duoFound} duo games out of ${result.processed} matches scanned!`
                  );
                  window.location.reload();
                } else {
                  toast.info(
                    `Scanned ${result.processed} matches but no duo games were found. Try syncing more games first.`
                  );
                }
              });
            }}
          >
            {isBackfilling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            {isBackfilling ? "Scanning..." : "Scan Existing Matches"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── DuoStatsCards ───────────────────────────────────────────────────────────

export function DuoStatsCards({ stats }: { stats: DuoStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="surface-glow">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Swords className="h-4 w-4" />
            Games Together
          </div>
          <p className="text-2xl font-bold">{stats.totalGames}</p>
        </CardContent>
      </Card>

      <Card className="surface-glow">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Trophy className="h-4 w-4" />
            Duo Win Rate
          </div>
          <p
            className={`text-2xl font-bold ${
              stats.winRate >= 50 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {stats.winRate}%
          </p>
          <p className="text-xs text-muted-foreground">
            {stats.wins}W / {stats.losses}L
          </p>
        </CardContent>
      </Card>

      <Card className="surface-glow">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            Solo Win Rate
          </div>
          <p
            className={`text-2xl font-bold ${
              stats.soloWinRate >= 50 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {stats.soloWinRate}%
          </p>
          <p className="text-xs text-muted-foreground">
            {stats.soloGames} games solo
          </p>
        </CardContent>
      </Card>

      <Card className="surface-glow">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            {stats.winRate > stats.soloWinRate ? (
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            ) : stats.winRate < stats.soloWinRate ? (
              <TrendingDown className="h-4 w-4 text-red-400" />
            ) : (
              <Swords className="h-4 w-4" />
            )}
            Duo Diff
          </div>
          <p
            className={`text-2xl font-bold ${
              stats.winRate - stats.soloWinRate > 0
                ? "text-emerald-400"
                : stats.winRate - stats.soloWinRate < 0
                  ? "text-red-400"
                  : ""
            }`}
          >
            {stats.winRate - stats.soloWinRate > 0 ? "+" : ""}
            {stats.winRate - stats.soloWinRate}%
          </p>
          <p className="text-xs text-muted-foreground">vs solo</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── DuoKdaCards ─────────────────────────────────────────────────────────────

export function DuoKdaCards({
  stats,
  partnerName,
}: {
  stats: DuoStats;
  partnerName: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle className="text-base">Your Avg KDA (Duo)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-bold">
            <span className="text-emerald-400">{stats.avgKills}</span>
            {" / "}
            <span className="text-red-400">{stats.avgDeaths}</span>
            {" / "}
            <span className="text-gold">{stats.avgAssists}</span>
          </p>
        </CardContent>
      </Card>

      <Card className="surface-glow">
        <CardHeader>
          <CardTitle className="text-base">
            {partnerName}&apos;s Avg KDA (Duo)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-bold">
            <span className="text-emerald-400">{stats.partnerAvgKills}</span>
            {" / "}
            <span className="text-red-400">{stats.partnerAvgDeaths}</span>
            {" / "}
            <span className="text-gold">{stats.partnerAvgAssists}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── DuoSynergyCard ─────────────────────────────────────────────────────────

export function DuoSynergyCard({
  synergy,
  partnerName,
  ddragonVersion,
}: {
  synergy: ChampionSynergy[];
  partnerName: string;
  ddragonVersion: string;
}) {
  type SynergySortKey = "games" | "winRate" | "wins";
  const [synergySortKey, setSynergySortKey] = useState<SynergySortKey>("games");
  const [synergySortDesc, setSynergySortDesc] = useState(true);

  const sortedSynergy = useMemo(() => {
    return [...synergy].sort((a, b) => {
      const aVal = synergySortKey === "wins" ? a.wins : a[synergySortKey];
      const bVal = synergySortKey === "wins" ? b.wins : b[synergySortKey];
      return synergySortDesc ? bVal - aVal : aVal - bVal;
    });
  }, [synergy, synergySortKey, synergySortDesc]);

  function toggleSynergySort(key: SynergySortKey) {
    if (synergySortKey === key) {
      setSynergySortDesc((d) => !d);
    } else {
      setSynergySortKey(key);
      setSynergySortDesc(true);
    }
  }

  return (
    <Card className="surface-glow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Champion Synergy</CardTitle>
            <CardDescription>
              Your champion combos with {partnerName}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {(["games", "winRate", "wins"] as const).map((key) => (
              <Button
                key={key}
                variant={synergySortKey === key ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => toggleSynergySort(key)}
              >
                {key === "games"
                  ? "Games"
                  : key === "winRate"
                    ? "Win %"
                    : "Wins"}
                {synergySortKey === key && (
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                )}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {synergy.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No champion synergy data yet. Play more duo games to see your best champion combos.
          </p>
        ) : (
        <div className="space-y-2">
          {sortedSynergy.map((s) => (
            <div
              key={`${s.yourChampion}-${s.partnerChampion}`}
              className="flex items-center gap-3 rounded-lg border border-border/50 p-2 bg-surface-elevated"
            >
              <div className="flex items-center gap-1">
                <ChampionIcon
                  championName={s.yourChampion}
                  version={ddragonVersion}
                  size={28}
                />
                <span className="text-xs text-muted-foreground mx-1">+</span>
                <ChampionIcon
                  championName={s.partnerChampion}
                  version={ddragonVersion}
                  size={28}
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">
                  <ChampionLink
                    champion={s.yourChampion}
                    ddragonVersion={ddragonVersion}
                    linkTo="matches"
                    showIcon={false}
                    textClassName="text-sm font-medium"
                  />
                  {" + "}
                  {s.partnerChampion}
                </span>
              </div>
              <div className="text-right text-sm">
                <span
                  className={`font-bold ${
                    s.winRate >= 50 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {s.winRate}%
                </span>
                <span className="text-muted-foreground ml-1.5">
                  {s.wins}W / {s.games}G
                </span>
              </div>
            </div>
          ))}
        </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── DuoRecentGames ─────────────────────────────────────────────────────────

export function DuoRecentGames({
  initialGames,
  initialTotalPages,
  partnerName,
  ddragonVersion,
}: {
  initialGames: DuoGameRow[];
  initialTotalPages: number;
  partnerName: string;
  ddragonVersion: string;
}) {
  const [games, setGames] = useState(initialGames);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [isPending, startTransition] = useTransition();
  const { data: authSession } = useSession();
  const locale = authSession?.user?.locale ?? DEFAULT_LOCALE;

  function handlePageChange(page: number) {
    startTransition(async () => {
      const result = await getDuoGames(page);
      setGames(result.games);
      setTotalPages(result.totalPages);
      setCurrentPage(page);
    });
  }

  return (
    <Card className="surface-glow">
      <CardHeader>
        <CardTitle>Recent Duo Games</CardTitle>
        <CardDescription>
          Games played together with {partnerName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {games.length > 0 ? (
          <div className="space-y-2">
            {games.map((game) => (
              <Link
                key={game.id}
                href={`/matches/${game.id}`}
                className="flex items-center gap-3 flex-wrap sm:flex-nowrap rounded-lg border border-border/50 p-3 bg-surface-elevated hover:bg-accent transition-colors"
              >
                <Badge
                  variant={
                    game.result === "Victory" ? "default" : "destructive"
                  }
                  className={`w-12 justify-center text-xs ${
                    game.result === "Victory"
                      ? "bg-emerald-400/20 text-emerald-400 border-emerald-400/30"
                      : ""
                  }`}
                >
                  {game.result === "Victory" ? "W" : "L"}
                </Badge>

                <div className="flex items-center gap-2 min-w-0">
                  <ChampionIcon
                    championName={game.championName}
                    version={ddragonVersion}
                  />
                  <div>
                    <p className="text-sm font-medium">{game.championName}</p>
                    <p className="text-xs text-muted-foreground">
                      {game.kills}/{game.deaths}/{game.assists}
                    </p>
                  </div>
                </div>

                <span className="text-xs text-muted-foreground">+</span>

                <div className="flex items-center gap-2 min-w-0">
                  <ChampionIcon
                    championName={game.partnerChampionName}
                    version={ddragonVersion}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {game.partnerChampionName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {game.partnerKills}/{game.partnerDeaths}/
                      {game.partnerAssists}
                    </p>
                  </div>
                </div>

                <div className="ml-auto text-right text-xs text-muted-foreground shrink-0">
                  <p>{formatDuration(game.gameDurationSeconds)}</p>
                  <p>{formatDate(game.gameDate, locale, "short")}</p>
                </div>
              </Link>
            ))}

            {isPending && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            <Pagination
              currentPage={currentPage}
              totalItems={totalPages * PAGE_SIZE}
              pageSize={PAGE_SIZE}
              onPageChange={handlePageChange}
            />
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No duo games found yet.</p>
            <p className="text-sm mt-1">
              Sync your matches to detect games played with your duo partner.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

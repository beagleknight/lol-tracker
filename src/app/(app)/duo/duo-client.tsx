"use client";

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
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useMemo, useTransition } from "react";
import { toast } from "sonner";

import type { DuoStats, DuoGameRow, ChampionSynergy } from "@/app/actions/duo";

import { getDuoGames, backfillDuoGames } from "@/app/actions/duo";
import { ChampionLink } from "@/components/champion-link";
import { ChampionIcon } from "@/components/icons/champion-icon";
import { Pagination } from "@/components/pagination";
import { ResultBadge } from "@/components/result-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-client";
import { formatDate, formatDuration, DEFAULT_LOCALE } from "@/lib/format";

const PAGE_SIZE = 10;

// ─── DuoHeader ───────────────────────────────────────────────────────────────

export function DuoHeader({ partnerName }: { partnerName: string | null }) {
  const t = useTranslations("Duo");
  return (
    <div>
      <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">
        {partnerName ? (
          <>
            {t("descriptionWithPartner", { partnerName: "" })}
            <span className="font-medium text-gold">{partnerName}</span>
          </>
        ) : (
          t("descriptionDefault")
        )}
      </p>
    </div>
  );
}

// ─── DuoNoPartner ────────────────────────────────────────────────────────────

export function DuoNoPartner() {
  const t = useTranslations("Duo");
  return (
    <Card className="surface-glow">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="mb-4 h-12 w-12 text-muted-foreground/30" />
        <h3 className="mb-2 text-lg font-semibold">{t("noPartner.title")}</h3>
        <p className="mb-4 max-w-md text-sm text-muted-foreground">{t("noPartner.description")}</p>
        <Link href="/settings">
          <Button>
            <Settings className="mr-2 h-4 w-4" />
            {t("noPartner.goToSettings")}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── DuoNoGames ──────────────────────────────────────────────────────────────

export function DuoNoGames() {
  const t = useTranslations("Duo");
  const [isBackfilling, startBackfill] = useTransition();

  return (
    <Card className="surface-glow">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Swords className="mb-4 h-12 w-12 text-muted-foreground/30" />
        <h3 className="mb-2 text-lg font-semibold">{t("noGames.title")}</h3>
        <p className="mb-4 max-w-md text-sm text-muted-foreground">{t("noGames.description")}</p>
        <div className="flex gap-3">
          <Button
            disabled={isBackfilling}
            onClick={() => {
              startBackfill(async () => {
                const result = await backfillDuoGames();
                if (result.duoFound > 0) {
                  toast.success(
                    t("toasts.backfillSuccess", {
                      duoFound: result.duoFound,
                      processed: result.processed,
                    }),
                  );
                  window.location.reload();
                } else {
                  toast.info(t("toasts.backfillNone", { processed: result.processed }));
                }
              });
            }}
          >
            {isBackfilling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            {isBackfilling ? t("noGames.scanningButton") : t("noGames.scanButton")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── DuoStatsCards ───────────────────────────────────────────────────────────

export function DuoStatsCards({ stats }: { stats: DuoStats }) {
  const t = useTranslations("Duo");
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card className="surface-glow">
        <CardContent className="pt-6">
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Swords className="h-4 w-4" />
            {t("stats.gamesTogetherLabel")}
          </div>
          <p className="text-2xl font-bold">{stats.totalGames}</p>
        </CardContent>
      </Card>

      <Card className="surface-glow">
        <CardContent className="pt-6">
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4" />
            {t("stats.duoWinRateLabel")}
          </div>
          <p className={`text-2xl font-bold ${stats.winRate >= 50 ? "text-win" : "text-loss"}`}>
            {stats.winRate}%
          </p>
          <p className="text-xs text-muted-foreground">
            {t("stats.winsLosses", { wins: stats.wins, losses: stats.losses })}
          </p>
        </CardContent>
      </Card>

      <Card className="surface-glow">
        <CardContent className="pt-6">
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            {t("stats.soloWinRateLabel")}
          </div>
          <p className={`text-2xl font-bold ${stats.soloWinRate >= 50 ? "text-win" : "text-loss"}`}>
            {stats.soloWinRate}%
          </p>
          <p className="text-xs text-muted-foreground">
            {t("stats.soloGamesCount", { soloGames: stats.soloGames })}
          </p>
        </CardContent>
      </Card>

      <Card className="surface-glow">
        <CardContent className="pt-6">
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            {stats.winRate > stats.soloWinRate ? (
              <TrendingUp className="h-4 w-4 text-win" />
            ) : stats.winRate < stats.soloWinRate ? (
              <TrendingDown className="h-4 w-4 text-loss" />
            ) : (
              <Swords className="h-4 w-4" />
            )}
            {t("stats.duoDiffLabel")}
          </div>
          <p
            className={`text-2xl font-bold ${
              stats.winRate - stats.soloWinRate > 0
                ? "text-win"
                : stats.winRate - stats.soloWinRate < 0
                  ? "text-loss"
                  : ""
            }`}
          >
            {stats.winRate - stats.soloWinRate > 0 ? "+" : ""}
            {stats.winRate - stats.soloWinRate}%
          </p>
          <p className="text-xs text-muted-foreground">{t("stats.vsSolo")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── DuoKdaCards ─────────────────────────────────────────────────────────────

export function DuoKdaCards({ stats, partnerName }: { stats: DuoStats; partnerName: string }) {
  const t = useTranslations("Duo");
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle className="text-base">{t("kda.yourAvgKdaTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-bold">
            <span className="text-kills">{stats.avgKills}</span>
            {" / "}
            <span className="text-deaths">{stats.avgDeaths}</span>
            {" / "}
            <span className="text-gold">{stats.avgAssists}</span>
          </p>
        </CardContent>
      </Card>

      <Card className="surface-glow">
        <CardHeader>
          <CardTitle className="text-base">
            {t("kda.partnerAvgKdaTitle", { partnerName })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-bold">
            <span className="text-kills">{stats.partnerAvgKills}</span>
            {" / "}
            <span className="text-deaths">{stats.partnerAvgDeaths}</span>
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
  const t = useTranslations("Duo");
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
            <CardTitle>{t("synergy.title")}</CardTitle>
            <CardDescription>{t("synergy.description", { partnerName })}</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {(["games", "winRate", "wins"] as const).map((key) => (
              <Button
                key={key}
                variant={synergySortKey === key ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => toggleSynergySort(key)}
              >
                {key === "games"
                  ? t("synergy.sortGames")
                  : key === "winRate"
                    ? t("synergy.sortWinRate")
                    : t("synergy.sortWins")}
                {synergySortKey === key && <ArrowUpDown className="ml-1 h-3 w-3" />}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {synergy.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("synergy.emptyState")}
          </p>
        ) : (
          <div className="space-y-2">
            {sortedSynergy.map((s) => (
              <div
                key={`${s.yourChampion}-${s.partnerChampion}`}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-elevated p-2"
              >
                <div className="flex items-center gap-1">
                  <ChampionIcon championName={s.yourChampion} size={28} />
                  <span className="mx-1 text-xs text-muted-foreground">+</span>
                  <ChampionIcon championName={s.partnerChampion} size={28} />
                </div>
                <div className="min-w-0 flex-1">
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
                  <span className={`font-bold ${s.winRate >= 50 ? "text-win" : "text-loss"}`}>
                    {s.winRate}%
                  </span>
                  <span className="ml-1.5 text-muted-foreground">
                    {t("synergy.winsGames", { wins: s.wins, games: s.games })}
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
  ddragonVersion: _ddragonVersion,
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
  const { user } = useAuth();
  const t = useTranslations("Duo");
  const locale = user?.locale ?? DEFAULT_LOCALE;

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
        <CardTitle>{t("recentGames.title")}</CardTitle>
        <CardDescription>{t("recentGames.description", { partnerName })}</CardDescription>
      </CardHeader>
      <CardContent>
        {games.length > 0 ? (
          <div className="space-y-2">
            {games.map((game) => (
              <Link
                key={game.id}
                href={`/matches/${game.id}`}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-surface-elevated p-3 transition-colors hover:bg-accent sm:flex-nowrap"
              >
                <ResultBadge
                  result={game.result}
                  className={`w-12 justify-center ${
                    game.result === "Victory" ? "border-win/30 bg-win/20 text-win" : ""
                  }`}
                />

                <div className="flex min-w-0 items-center gap-2">
                  <ChampionIcon championName={game.championName} />
                  <div>
                    <p className="text-sm font-medium">{game.championName}</p>
                    <p className="text-xs text-muted-foreground">
                      {game.kills}/{game.deaths}/{game.assists}
                    </p>
                  </div>
                </div>

                <span className="text-xs text-muted-foreground">+</span>

                <div className="flex min-w-0 items-center gap-2">
                  <ChampionIcon championName={game.partnerChampionName} />
                  <div>
                    <p className="text-sm font-medium">{game.partnerChampionName}</p>
                    <p className="text-xs text-muted-foreground">
                      {game.partnerKills}/{game.partnerDeaths}/{game.partnerAssists}
                    </p>
                  </div>
                </div>

                <div className="ml-auto shrink-0 text-right text-xs text-muted-foreground">
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
          <div className="py-8 text-center text-muted-foreground">
            <p>{t("recentGames.emptyTitle")}</p>
            <p className="mt-1 text-sm">{t("recentGames.emptyDescription")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

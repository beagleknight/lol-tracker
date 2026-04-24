"use client";

import { BarChart3, ArrowUpDown, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";

import type { AnalyticsData } from "@/lib/queries/analytics";

import { ChampionLink } from "@/components/champion-link";
import { EmptyState } from "@/components/empty-state";
import { RuneIcon } from "@/components/icons/rune-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const AnalyticsCharts = dynamic(() => import("./analytics-charts").then((m) => m.AnalyticsCharts), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="surface-glow">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-1 h-3 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card className="surface-glow">
          <CardHeader>
            <Skeleton className="h-5 w-64" />
            <Skeleton className="mt-1 h-3 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="surface-glow">
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-1 h-3 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  ),
});

const TABLE_INITIAL_ROWS = 10;

interface AnalyticsClientProps {
  data: AnalyticsData;
  readOnly?: boolean;
}

export function AnalyticsClient({ data }: AnalyticsClientProps) {
  const t = useTranslations("Analytics");

  const {
    rankChartData,
    lpChartMeta,
    rollingWR,
    coachingBands,
    topMatchups,
    runeStats,
    championStats,
    meaningfulCount,
    totalCount,
    ddragonVersion,
    goalTargetLP,
    goalTargetLabel,
  } = data;

  // ─── Sort state for Rune Keystones table ──────────────────────────────────
  type RuneSortKey = "games" | "winRate";
  const [runeSortKey, setRuneSortKey] = useState<RuneSortKey>("games");
  const [runeSortDesc, setRuneSortDesc] = useState(true);
  const [showAllRunes, setShowAllRunes] = useState(false);

  const sortedRuneStats = useMemo(() => {
    return [...runeStats].sort((a, b) => {
      const aVal = a[runeSortKey];
      const bVal = b[runeSortKey];
      return runeSortDesc ? bVal - aVal : aVal - bVal;
    });
  }, [runeStats, runeSortKey, runeSortDesc]);

  function toggleRuneSort(key: RuneSortKey) {
    if (runeSortKey === key) {
      setRuneSortDesc((d) => !d);
    } else {
      setRuneSortKey(key);
      setRuneSortDesc(true);
    }
  }

  // ─── Sort state for Champion Stats table ──────────────────────────────────
  type ChampSortKey = "games" | "winRate" | "avgKDA";
  const [champSortKey, setChampSortKey] = useState<ChampSortKey>("games");
  const [champSortDesc, setChampSortDesc] = useState(true);
  const [showAllChamps, setShowAllChamps] = useState(false);

  const sortedChampionStats = useMemo(() => {
    return [...championStats].sort((a, b) => {
      if (champSortKey === "avgKDA") {
        const aVal = a.avgKDA === "Perfect" ? 999 : parseFloat(a.avgKDA);
        const bVal = b.avgKDA === "Perfect" ? 999 : parseFloat(b.avgKDA);
        return champSortDesc ? bVal - aVal : aVal - bVal;
      }
      const aVal = a[champSortKey];
      const bVal = b[champSortKey];
      return champSortDesc ? bVal - aVal : aVal - bVal;
    });
  }, [championStats, champSortKey, champSortDesc]);

  function toggleChampSort(key: ChampSortKey) {
    if (champSortKey === key) {
      setChampSortDesc((d) => !d);
    } else {
      setChampSortKey(key);
      setChampSortDesc(true);
    }
  }

  const visibleRunes = showAllRunes
    ? sortedRuneStats
    : sortedRuneStats.slice(0, TABLE_INITIAL_ROWS);
  const visibleChamps = showAllChamps
    ? sortedChampionStats
    : sortedChampionStats.slice(0, TABLE_INITIAL_ROWS);

  if (totalCount === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("pageTitle")}</h1>
          <p className="text-muted-foreground">{t("importGamesFirst")}</p>
        </div>
        <EmptyState
          icon={BarChart3}
          title={t("noDataYetTitle")}
          description={t("noDataYetDescription")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="animate-in-up">
        <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">{t("gamesAnalyzed", { count: meaningfulCount })}</p>
      </div>

      {/* Charts — lazy-loaded (recharts ~360 KB deferred) */}
      <AnalyticsCharts
        rankChartData={rankChartData}
        lpChartMeta={lpChartMeta}
        rollingWR={rollingWR}
        coachingBands={coachingBands}
        topMatchups={topMatchups}
        goalTargetLP={goalTargetLP}
        goalTargetLabel={goalTargetLabel}
      />

      {/* Rune Keystones + Champion Stats (no recharts needed) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Rune Comparison — shares grid row with matchup chart above on lg */}
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle>{t("runeKeystones")}</CardTitle>
            <CardDescription>{t("runeKeystonesDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {runeStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noRuneData")}</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("tableHeaders.keystone")}</TableHead>
                      <TableHead className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-1.5 h-6 px-1.5 text-xs"
                          onClick={() => toggleRuneSort("games")}
                        >
                          {t("tableHeaders.games")}
                          {runeSortKey === "games" && <ArrowUpDown className="ml-1 h-3 w-3" />}
                        </Button>
                      </TableHead>
                      <TableHead className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-1.5 h-6 px-1.5 text-xs"
                          onClick={() => toggleRuneSort("winRate")}
                        >
                          {t("tableHeaders.winRate")}
                          {runeSortKey === "winRate" && <ArrowUpDown className="ml-1 h-3 w-3" />}
                        </Button>
                      </TableHead>
                      <TableHead className="text-center">{t("tableHeaders.wl")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRunes.map((rune) => (
                      <TableRow key={rune.name}>
                        <TableCell className="text-sm font-medium">
                          <span className="flex items-center gap-1.5">
                            <RuneIcon keystoneName={rune.name} alt={rune.name} size={18} />
                            {rune.name}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm">
                          {rune.games}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={rune.winRate >= 50 ? "default" : "destructive"}
                            className="font-mono text-xs"
                          >
                            {rune.winRate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm text-muted-foreground">
                          {rune.wins}W {rune.losses}L
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {sortedRuneStats.length > TABLE_INITIAL_ROWS && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full text-xs text-muted-foreground"
                    onClick={() => setShowAllRunes((v) => !v)}
                  >
                    {showAllRunes ? t("showLess") : t("showAll", { count: sortedRuneStats.length })}
                    <ChevronDown
                      className={`ml-1 h-3 w-3 transition-transform ${showAllRunes ? "rotate-180" : ""}`}
                    />
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Champion Stats */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle>{t("championStats")}</CardTitle>
          <CardDescription>{t("championStatsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedChampionStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noChampionData")}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tableHeaders.champion")}</TableHead>
                    <TableHead className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-1.5 h-6 px-1.5 text-xs"
                        onClick={() => toggleChampSort("games")}
                      >
                        {t("tableHeaders.games")}
                        {champSortKey === "games" && <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-1.5 h-6 px-1.5 text-xs"
                        onClick={() => toggleChampSort("winRate")}
                      >
                        {t("tableHeaders.winRate")}
                        {champSortKey === "winRate" && <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">{t("tableHeaders.wl")}</TableHead>
                    <TableHead className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-1.5 h-6 px-1.5 text-xs"
                        onClick={() => toggleChampSort("avgKDA")}
                      >
                        {t("tableHeaders.avgKda")}
                        {champSortKey === "avgKDA" && <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleChamps.map((champ) => (
                    <TableRow key={champ.name}>
                      <TableCell className="text-sm font-medium">
                        <ChampionLink
                          champion={champ.name}
                          ddragonVersion={ddragonVersion}
                          linkTo="scout-your"
                          iconSize={24}
                          textClassName="font-medium text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">{champ.games}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={champ.winRate >= 50 ? "default" : "destructive"}
                          className="font-mono text-xs"
                        >
                          {champ.winRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm text-muted-foreground">
                        {champ.wins}W {champ.losses}L
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {champ.avgKDA === "Perfect" ? t("perfectKda") : champ.avgKDA}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {sortedChampionStats.length > TABLE_INITIAL_ROWS && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full text-xs text-muted-foreground"
                  onClick={() => setShowAllChamps((v) => !v)}
                >
                  {showAllChamps
                    ? t("showLess")
                    : t("showAll", { count: sortedChampionStats.length })}
                  <ChevronDown
                    className={`ml-1 h-3 w-3 transition-transform ${showAllChamps ? "rotate-180" : ""}`}
                  />
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

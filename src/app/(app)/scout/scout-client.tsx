"use client";

import {
  Crosshair,
  Swords,
  Loader2,
  TrendingUp,
  BarChart3,
  Users,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import type { ChampionPickCount } from "@/app/actions/live";

import { generateMatchupInsight } from "@/app/actions/ai-insights";
import { getMatchupReport, type MatchupReport } from "@/app/actions/live";
import { getMatchupNotes, type MatchupNoteData } from "@/app/actions/matchup-notes";
import { AiInsightDrawer } from "@/components/ai-insight-card";
import { ChampionCombobox, type ChampionRecommendations } from "@/components/champion-combobox";
import { EmptyState } from "@/components/empty-state";
import { MatchCard } from "@/components/match-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-client";
import { formatDate, formatNumber, DEFAULT_LOCALE } from "@/lib/format";
import { getKeystoneIconUrlByName, getChampionIconUrl } from "@/lib/riot-api";

import { MatchupNotesTrigger, MatchupNotesPanel, pickActiveNote } from "./matchup-notes";

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
      unoptimized={size <= 32}
      className="rounded"
    />
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface ScoutClientProps {
  ddragonVersion: string;
  allChampions: string[];
  isRiotLinked: boolean;
  isAiConfigured: boolean;
  initialYourChampion?: string;
  initialEnemyChampion?: string;
  mostPlayed?: ChampionPickCount[];
  mostFaced?: ChampionPickCount[];
  readOnly?: boolean;
}

// ─── Scouting Report ────────────────────────────────────────────────────────

function ScoutingReport({
  report,
  ddragonVersion,
  locale,
  matchupNotes,
  yourChampionName,
  isAiConfigured,
  onNotesChanged,
  readOnly,
}: {
  report: MatchupReport;
  ddragonVersion: string;
  locale: string;
  matchupNotes: MatchupNoteData[];
  yourChampionName?: string;
  isAiConfigured: boolean;
  onNotesChanged?: () => void;
  readOnly?: boolean;
}) {
  const { record, runeBreakdown, avgStats, overallAvgStats, duoPairs, games } = report;
  const t = useTranslations("Scout");
  const tAi = useTranslations("AiInsights");
  const { user } = useAuth();
  const isReadOnly = readOnly || user?.isDemoUser;
  const [notesOpen, setNotesOpen] = useState(false);

  const { activeNote, activeChampionName } = pickActiveNote(matchupNotes, yourChampionName);
  const hasNote = !!activeNote?.content;

  // Compute matchup KDA ratio for comparison
  const matchupKdaRatio =
    avgStats.deaths === 0
      ? 0
      : Math.round(((avgStats.kills + avgStats.assists) / avgStats.deaths) * 10) / 10;
  const overallKdaRatio =
    overallAvgStats.deaths === 0
      ? 0
      : Math.round(
          ((overallAvgStats.kills + overallAvgStats.assists) / overallAvgStats.deaths) * 10,
        ) / 10;

  return (
    <div className="space-y-6">
      {/* Header: Record summary */}
      <div>
        <div className="flex items-center gap-4">
          {yourChampionName ? (
            <div className="flex items-center gap-2">
              <ChampionIcon championName={yourChampionName} version={ddragonVersion} size={48} />
              <span className="text-sm font-medium text-muted-foreground">{t("vs")}</span>
              <ChampionIcon
                championName={report.matchupChampionName}
                version={ddragonVersion}
                size={48}
              />
            </div>
          ) : (
            <ChampionIcon
              championName={report.matchupChampionName}
              version={ddragonVersion}
              size={56}
            />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">
                {yourChampionName
                  ? `${yourChampionName} ${t("vs")} ${report.matchupChampionName}`
                  : `${t("vs")} ${report.matchupChampionName}`}
              </h2>
              {!isReadOnly && (
                <MatchupNotesTrigger
                  hasNote={hasNote}
                  isOpen={notesOpen}
                  onToggle={() => setNotesOpen(!notesOpen)}
                />
              )}
              {!isReadOnly && (
                <AiInsightDrawer
                  title={tAi("matchupTitle")}
                  isConfigured={isAiConfigured}
                  locale={locale}
                  onGenerate={(forceRegenerate) =>
                    generateMatchupInsight(
                      report.matchupChampionName,
                      yourChampionName,
                      report,
                      forceRegenerate,
                    )
                  }
                />
              )}
            </div>
            <div className="mt-1 flex items-center gap-3">
              <span className="font-mono text-lg">
                <span className="text-win">{record.wins}W</span>{" "}
                <span className="text-loss">{record.losses}L</span>
              </span>
              <Badge
                variant={record.winRate >= 50 ? "default" : "destructive"}
                className="font-mono text-sm"
              >
                {record.winRate}%
              </Badge>
            </div>
            {report.lastPlayed && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("lastPlayed", { date: formatDate(report.lastPlayed, locale) })}
              </p>
            )}
          </div>
        </div>

        {/* Notes panel — renders below the header row */}
        {!isReadOnly && notesOpen && (
          <div className="mt-3">
            <MatchupNotesPanel
              note={activeNote}
              championName={activeChampionName}
              matchupChampionName={report.matchupChampionName}
              locale={locale}
              onSaved={() => onNotesChanged?.()}
              onClose={() => setNotesOpen(false)}
            />
          </div>
        )}
      </div>

      <Separator />

      {/* Rune Performance */}
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-neon-purple" />
          {t("runePerformance")}
        </h3>
        {runeBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noRuneData")}</p>
        ) : (
          <div className="space-y-2">
            {runeBreakdown.map((rune) => (
              <div key={rune.keystoneName} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    {(() => {
                      const url = getKeystoneIconUrlByName(rune.keystoneName);
                      return url ? (
                        <Image
                          src={url}
                          alt={rune.keystoneName}
                          width={18}
                          height={18}
                          unoptimized
                          className="rounded"
                        />
                      ) : null;
                    })()}
                    {rune.keystoneName}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {rune.wins}W {rune.losses}L ({rune.winRate}%) &middot;{" "}
                    {t("gamesCount", { count: rune.games })}
                  </span>
                </div>
                <Progress value={rune.winRate} className="h-2" />
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Avg Stats with comparison */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4 text-electric" />
            {t("averageStats")}
          </h3>
          {overallAvgStats.games > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {t("vsYourAvg", { count: overallAvgStats.games })}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <StatCell
            label={t("statLabels.kda")}
            value={`${avgStats.kills}/${avgStats.deaths}/${avgStats.assists}`}
          />
          <StatCell
            label={t("statLabels.csPerMin")}
            value={String(avgStats.csPerMin)}
            baseline={{ matchup: avgStats.csPerMin, overall: overallAvgStats.csPerMin }}
          />
          <StatCell
            label={t("statLabels.gold")}
            value={formatNumber(avgStats.goldEarned, locale)}
            baseline={{ matchup: avgStats.goldEarned, overall: overallAvgStats.goldEarned }}
          />
          <StatCell
            label={t("statLabels.vision")}
            value={String(avgStats.visionScore)}
            baseline={{ matchup: avgStats.visionScore, overall: overallAvgStats.visionScore }}
          />
          <StatCell
            label={t("statLabels.kdaRatio")}
            value={avgStats.deaths === 0 ? t("perfectKda") : String(matchupKdaRatio)}
            baseline={{ matchup: matchupKdaRatio, overall: overallKdaRatio }}
          />
          <StatCell label={t("statLabels.games")} value={String(record.total)} />
        </div>
      </div>

      {/* Duo Pairs in this matchup */}
      {duoPairs.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-electric" />
              {t("duoPairsTitle")}
            </h3>
            <div className="space-y-2">
              {duoPairs.map((pair) => (
                <div
                  key={`${pair.yourChampion}-${pair.duoChampion}`}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-elevated p-2"
                >
                  <div className="flex items-center gap-1">
                    <ChampionIcon
                      championName={pair.yourChampion}
                      version={ddragonVersion}
                      size={28}
                    />
                    <span className="mx-1 text-xs text-muted-foreground">+</span>
                    <ChampionIcon
                      championName={pair.duoChampion}
                      version={ddragonVersion}
                      size={28}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">
                      {pair.yourChampion} + {pair.duoChampion}
                    </span>
                  </div>
                  <div className="text-right font-mono text-sm">
                    <span className={`font-bold ${pair.winRate >= 50 ? "text-win" : "text-loss"}`}>
                      {pair.winRate}%
                    </span>
                    <span className="ml-1.5 text-muted-foreground">
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
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Swords className="h-4 w-4 text-gold" />
          {t("pastGames", { count: games.length })}
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
                position: game.position,
              }}
              ddragonVersion={ddragonVersion}
              matchHighlights={game.highlights.map((h) => ({
                type: h.type,
                text: h.text,
                topicName: h.topicName,
              }))}
              locale={locale}
              userPrimaryRole={user?.primaryRole}
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
  const t = useTranslations("Scout");
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
      <p className="mt-0.5 font-mono text-sm font-medium">{value}</p>
      {delta !== null && delta !== 0 && (
        <p
          className={`mt-0.5 flex items-center justify-center gap-0.5 font-mono text-[10px] ${
            isPositive ? "text-win" : isNegative ? "text-loss" : "text-muted-foreground"
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
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{t("avg")}</p>
      )}
    </div>
  );
}

// ─── Standalone Notes Bubble (for no-data state) ────────────────────────────

function NoDataNotesBubble({
  notes,
  matchupChampionName,
  yourChampionName,
  locale,
  onNotesChanged,
}: {
  notes: MatchupNoteData[];
  matchupChampionName: string;
  yourChampionName?: string;
  locale: string;
  onNotesChanged?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { activeNote, activeChampionName } = pickActiveNote(notes, yourChampionName);
  const hasNote = !!activeNote?.content;

  return (
    <div className="flex flex-col items-center gap-2">
      <MatchupNotesTrigger hasNote={hasNote} isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} />
      {isOpen && (
        <div className="w-full">
          <MatchupNotesPanel
            note={activeNote}
            championName={activeChampionName}
            matchupChampionName={matchupChampionName}
            locale={locale}
            onSaved={() => onNotesChanged?.()}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main Scout Client ──────────────────────────────────────────────────────

export function ScoutClient({
  ddragonVersion,
  allChampions,
  isRiotLinked: _isRiotLinked,
  isAiConfigured,
  initialYourChampion = "",
  initialEnemyChampion = "",
  mostPlayed = [],
  mostFaced = [],
  readOnly,
}: ScoutClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isReadOnly = readOnly || user?.isDemoUser;
  const locale = user?.locale ?? DEFAULT_LOCALE;
  const t = useTranslations("Scout");
  const [yourChampion, setYourChampion] = useState<string>(initialYourChampion);
  const [enemyChampion, setEnemyChampion] = useState<string>(initialEnemyChampion);
  const [report, setReport] = useState<MatchupReport | null>(null);
  const [matchupNotesList, setMatchupNotesList] = useState<MatchupNoteData[]>([]);
  const [isLoadingReport, startReportTransition] = useTransition();

  // Sync URL params -> local state when browser back/forward navigation occurs
  const isUpdatingUrl = useRef(false);
  useEffect(() => {
    if (isUpdatingUrl.current) {
      isUpdatingUrl.current = false;
      return;
    }
    const urlYour = searchParams.get("your") || "";
    const urlEnemy = searchParams.get("enemy") || "";
    if (urlYour !== yourChampion) setYourChampion(urlYour);
    if (urlEnemy !== enemyChampion) {
      setEnemyChampion(urlEnemy);
      if (urlEnemy) {
        loadReport(urlEnemy, urlYour || undefined);
      } else {
        setReport(null);
        setMatchupNotesList([]);
      }
    }
    // Only react to searchParams changes (browser navigation)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /** Push champion selections to the URL without a full page reload */
  const updateUrl = useCallback(
    (yours: string, enemy: string) => {
      const params = new URLSearchParams();
      if (yours) params.set("your", yours);
      if (enemy) params.set("enemy", enemy);
      const qs = params.toString();
      isUpdatingUrl.current = true;
      router.replace(`/scout${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router],
  );

  // Build recommendation groups for comboboxes
  const yourChampionRecs: ChampionRecommendations[] = useMemo(
    () =>
      mostPlayed.length > 0 ? [{ heading: t("mostPlayedHeading"), champions: mostPlayed }] : [],
    [mostPlayed, t],
  );

  const enemyChampionRecs: ChampionRecommendations[] = useMemo(
    () =>
      mostFaced.length > 0 ? [{ heading: t("commonMatchupsHeading"), champions: mostFaced }] : [],
    [mostFaced, t],
  );

  const loadReport = useCallback(
    (enemy: string, yours?: string) => {
      if (!enemy) {
        setReport(null);
        setMatchupNotesList([]);
        return;
      }
      startReportTransition(async () => {
        try {
          const [result, notes] = await Promise.all([
            getMatchupReport(enemy, yours || undefined),
            getMatchupNotes(enemy, yours || undefined),
          ]);
          setReport(result);
          setMatchupNotesList(notes);
        } catch {
          toast.error(t("toasts.failedToLoadReport"));
        }
      });
    },
    [t],
  );

  /** Re-fetch only notes (called after save/delete) */
  const refreshNotes = useCallback(() => {
    if (!enemyChampion) return;
    startReportTransition(async () => {
      try {
        const notes = await getMatchupNotes(enemyChampion, yourChampion || undefined);
        setMatchupNotesList(notes);
      } catch {
        // silent — the notes just won't refresh
      }
    });
  }, [enemyChampion, yourChampion]);

  // Auto-load report on mount if initial champions are provided via URL params
  useEffect(() => {
    if (initialEnemyChampion) {
      loadReport(initialEnemyChampion, initialYourChampion || undefined);
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnemyChange = useCallback(
    (value: string) => {
      setEnemyChampion(value);
      loadReport(value, yourChampion);
      updateUrl(yourChampion, value);
    },
    [yourChampion, loadReport, updateUrl],
  );

  const handleYourChampionChange = useCallback(
    (value: string) => {
      setYourChampion(value);
      updateUrl(value, enemyChampion);
      if (enemyChampion) {
        loadReport(enemyChampion, value);
      }
    },
    [enemyChampion, loadReport, updateUrl],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-gradient-gold flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Crosshair className="h-6 w-6" />
          {t("pageTitle")}
        </h1>
        <p className="text-muted-foreground">{t("pageDescription")}</p>
      </div>

      {/* Controls: two champion pickers */}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
        <ChampionCombobox
          value={yourChampion}
          onValueChange={handleYourChampionChange}
          champions={allChampions}
          ddragonVersion={ddragonVersion}
          placeholder={t("yourChampionPlaceholder")}
          label={t("yourChampionLabel")}
          className="flex-1 sm:max-w-xs"
          recommendations={yourChampionRecs}
        />
        <span className="flex items-center justify-center text-sm font-medium text-muted-foreground sm:items-end sm:pb-2">
          {t("vs")}
        </span>
        <ChampionCombobox
          value={enemyChampion}
          onValueChange={handleEnemyChange}
          champions={allChampions}
          ddragonVersion={ddragonVersion}
          placeholder={t("enemyChampionPlaceholder")}
          label={t("enemyChampionLabel")}
          className="flex-1 sm:max-w-xs"
          recommendations={enemyChampionRecs}
        />
      </div>

      {/* Loading state */}
      {isLoadingReport && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
          <span className="ml-2 text-muted-foreground">{t("loadingReport")}</span>
        </div>
      )}

      {/* Scouting report */}
      {!isLoadingReport && report && (
        <ScoutingReport
          report={report}
          ddragonVersion={ddragonVersion}
          locale={locale}
          matchupNotes={matchupNotesList}
          yourChampionName={yourChampion || undefined}
          isAiConfigured={isAiConfigured}
          onNotesChanged={refreshNotes}
          readOnly={isReadOnly}
        />
      )}

      {/* No historical data state */}
      {!isLoadingReport && !report && enemyChampion && (
        <div className="space-y-6">
          <EmptyState
            icon={Swords}
            title={
              yourChampion
                ? t("noGamesFoundAsChampion", { yourChampion, enemyChampion })
                : t("noGamesFound", { enemyChampion })
            }
            description={yourChampion ? t("clearYourChampionHint") : undefined}
            className="py-12"
          />

          {/* Still allow adding notes even without match history */}
          {!isReadOnly && (
            <NoDataNotesBubble
              notes={matchupNotesList}
              matchupChampionName={enemyChampion}
              yourChampionName={yourChampion || undefined}
              locale={locale}
              onNotesChanged={refreshNotes}
            />
          )}
        </div>
      )}

      {/* Initial state — no matchup selected */}
      {!enemyChampion && (
        <EmptyState
          icon={Crosshair}
          title={t("selectEnemyPrompt")}
          iconClassName="h-10 w-10 text-muted-foreground/50"
        />
      )}
    </div>
  );
}

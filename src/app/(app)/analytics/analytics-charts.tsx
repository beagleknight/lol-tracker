"use client";

import { TrendingUp, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
  Cell,
} from "recharts";

import type {
  RankChartPoint,
  LPChartMeta,
  WinRatePoint,
  CoachingBands,
  MatchupStat,
} from "@/lib/queries/analytics";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartColors } from "@/hooks/use-chart-colors";
import { getLocalChampionIconUrl } from "@/lib/ddragon-assets";
import { formatRank, formatTierDivision, getTierBoundaries } from "@/lib/rank";

interface AnalyticsChartsProps {
  rankChartData: RankChartPoint[];
  lpChartMeta: LPChartMeta | null;
  rollingWR: WinRatePoint[];
  coachingBands: CoachingBands;
  topMatchups: MatchupStat[];
  goalTargetLP: number | null;
  goalTargetLabel: string;
  /** Slot for content rendered alongside the matchup chart in the 2-col grid */
  children?: React.ReactNode;
}

export function AnalyticsCharts({
  rankChartData,
  lpChartMeta,
  rollingWR,
  coachingBands,
  topMatchups,
  goalTargetLP,
  goalTargetLabel,
  children,
}: AnalyticsChartsProps) {
  const t = useTranslations("Analytics");
  const cc = useChartColors();

  // Adjusted tier boundaries — extend range to include goal target if present
  const adjustedTierBoundaries = (() => {
    if (!lpChartMeta || goalTargetLP === null) return null;
    const yMin = Math.min(lpChartMeta.yMin, Math.floor((goalTargetLP - 50) / 100) * 100);
    const yMax = Math.max(lpChartMeta.yMax, Math.ceil((goalTargetLP + 50) / 100) * 100);
    if (yMin < lpChartMeta.yMin || yMax > lpChartMeta.yMax) {
      return getTierBoundaries(yMin, yMax);
    }
    return null;
  })();

  return (
    <>
      {/* Rank Journey + Win Rate side-by-side */}
      <div className="animate-in-up-delay-1 grid gap-6 lg:grid-cols-2">
        {rankChartData.length >= 2 && lpChartMeta ? (
          <Card className="surface-glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-gold" />
                {t("rankJourney")}
              </CardTitle>
              <CardDescription>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium text-foreground/80">
                    {t("peakLabel", { rank: lpChartMeta.peakRank })}
                  </span>
                  {lpChartMeta.netChange !== 0 && (
                    <span
                      className={`font-mono font-semibold ${
                        lpChartMeta.netChange >= 0 ? "text-win" : "text-loss"
                      }`}
                    >
                      {lpChartMeta.netChange >= 0 ? "+" : ""}
                      {t("lpOverall", { value: lpChartMeta.netChange })}
                    </span>
                  )}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={rankChartData}>
                    <defs>
                      <linearGradient id="lpGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={cc.gold} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={cc.gold} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={cc.chartGrid} />
                    <XAxis
                      dataKey="date"
                      stroke={cc.chartAxis}
                      fontSize={12}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke={cc.chartAxis}
                      fontSize={12}
                      domain={[
                        goalTargetLP !== null
                          ? Math.min(lpChartMeta.yMin, Math.floor((goalTargetLP - 50) / 100) * 100)
                          : lpChartMeta.yMin,
                        goalTargetLP !== null
                          ? Math.max(lpChartMeta.yMax, Math.ceil((goalTargetLP + 50) / 100) * 100)
                          : lpChartMeta.yMax,
                      ]}
                      tickFormatter={(v: number) => formatRank(v).split("—")[0].trim()}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: cc.chartTooltipBg,
                        border: `1px solid ${cc.chartTooltipBorder}`,
                        borderRadius: "8px",
                      }}
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload[0]) return null;
                        const d = payload[0].payload as RankChartPoint;
                        const idx = rankChartData.findIndex((r) => r.timestamp === d.timestamp);
                        const isPeak = idx === lpChartMeta.peakIndex;
                        const milestone = lpChartMeta.milestones.find((m) => m.index === idx);
                        return (
                          <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 shadow-lg">
                            {isPeak && (
                              <p className="mb-1 text-xs font-semibold text-gold">
                                {t("tooltips.peakRankAchieved")}
                              </p>
                            )}
                            {milestone && (
                              <p className="mb-1 text-xs font-semibold text-win">
                                {t("tooltips.firstTimeInTier", { tier: milestone.tier })}
                              </p>
                            )}
                            <p className="font-semibold text-gold">
                              {formatTierDivision(d.tier, d.division)}
                            </p>
                            <p className="text-sm">
                              <span className="text-gold/80">{d.lp} LP</span>
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {d.wins}W {d.losses}L &middot; {d.date}
                            </p>
                          </div>
                        );
                      }}
                    />
                    {/* Tier boundary reference lines */}
                    {(adjustedTierBoundaries ?? lpChartMeta.tierBoundaries).map((b) => (
                      <ReferenceLine
                        key={b.label}
                        y={b.lp}
                        stroke={cc.electric}
                        strokeDasharray="6 3"
                        label={{
                          value: b.label,
                          fill: cc.electric,
                          fontSize: 11,
                          position: "right",
                        }}
                      />
                    ))}
                    {/* Goal target reference line */}
                    {goalTargetLP !== null && (
                      <ReferenceLine
                        y={goalTargetLP}
                        stroke={cc.gold}
                        strokeDasharray="8 4"
                        strokeWidth={2}
                        label={({ viewBox }: { viewBox: { x: number; y: number } }) => {
                          const label = t("chartLabels.goalTarget", { rank: goalTargetLabel });
                          return (
                            <g>
                              <g transform={`translate(${viewBox.x + 4}, ${viewBox.y - 8})`}>
                                <circle
                                  cx="6"
                                  cy="6"
                                  r="5"
                                  fill="none"
                                  stroke={cc.gold}
                                  strokeWidth="1.5"
                                />
                                <circle cx="6" cy="6" r="2" fill={cc.gold} />
                                <line
                                  x1="6"
                                  y1="0"
                                  x2="6"
                                  y2="2.5"
                                  stroke={cc.gold}
                                  strokeWidth="1.5"
                                />
                                <line
                                  x1="6"
                                  y1="9.5"
                                  x2="6"
                                  y2="12"
                                  stroke={cc.gold}
                                  strokeWidth="1.5"
                                />
                                <line
                                  x1="0"
                                  y1="6"
                                  x2="2.5"
                                  y2="6"
                                  stroke={cc.gold}
                                  strokeWidth="1.5"
                                />
                                <line
                                  x1="9.5"
                                  y1="6"
                                  x2="12"
                                  y2="6"
                                  stroke={cc.gold}
                                  strokeWidth="1.5"
                                />
                              </g>
                              <text
                                x={viewBox.x + 20}
                                y={viewBox.y - 3}
                                fill={cc.gold}
                                fontSize={11}
                                fontWeight="bold"
                              >
                                {label}
                              </text>
                            </g>
                          );
                        }}
                      />
                    )}
                    {/* Promotion/demotion markers */}
                    {lpChartMeta.events.map((e, i) => (
                      <ReferenceLine
                        key={`event-${i}`}
                        x={rankChartData[e.index]?.date}
                        stroke={e.type === "promotion" ? cc.chartPromotion : cc.chartDemotion}
                        strokeDasharray="4 4"
                        label={{
                          value:
                            e.type === "promotion"
                              ? t("chartLabels.reached", { tier: e.to.split(" ")[0] })
                              : t("chartLabels.backTo", { tier: e.to.split(" ")[0] }),
                          fill: e.type === "promotion" ? cc.chartPromotion : cc.chartDemotion,
                          fontSize: 10,
                          position: "top",
                        }}
                      />
                    ))}
                    <Area
                      type="monotone"
                      dataKey="cumulativeLP"
                      stroke={cc.gold}
                      strokeWidth={2}
                      fill="url(#lpGradient)"
                      dot={false}
                      activeDot={{ r: 5, fill: cc.goldLight }}
                    />
                    {/* Peak rank dot */}
                    <ReferenceDot
                      x={rankChartData[lpChartMeta.peakIndex]?.date}
                      y={rankChartData[lpChartMeta.peakIndex]?.cumulativeLP}
                      r={6}
                      fill={cc.gold}
                      stroke={cc.goldLight}
                      strokeWidth={2}
                      label={{
                        value: t("peak"),
                        fill: cc.goldLight,
                        fontSize: 9,
                        fontWeight: "bold",
                        position: "top",
                        offset: 12,
                      }}
                    />
                    {/* Event dots (promotions/demotions) */}
                    {lpChartMeta.events.map((e, i) => (
                      <ReferenceDot
                        key={`event-dot-${i}`}
                        x={rankChartData[e.index]?.date}
                        y={rankChartData[e.index]?.cumulativeLP}
                        r={5}
                        fill={cc.gold}
                        stroke={cc.background}
                        strokeWidth={2}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="surface-glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-gold" />
                {t("rankJourney")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t("notEnoughRankData")}</p>
            </CardContent>
          </Card>
        )}

        {/* Win Rate Over Time */}
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gold" />
              {t("winRateOverTime")}
            </CardTitle>
            <CardDescription>
              {coachingBands.bands.length > 0
                ? t("coachingBandsDescription")
                : t("noCoachingSessions")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rollingWR}>
                  <CartesianGrid strokeDasharray="3 3" stroke={cc.chartGrid} />
                  <XAxis
                    dataKey="date"
                    stroke={cc.chartAxis}
                    fontSize={12}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke={cc.chartAxis}
                    fontSize={12}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    cursor={{ stroke: cc.chartReference }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload[0]) return null;
                      const d = payload[0].payload as WinRatePoint;
                      return (
                        <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 shadow-lg">
                          <p className="text-sm font-semibold text-foreground">{d.date}</p>
                          <p className="text-sm">
                            {t("tooltips.winRate")}{" "}
                            <span className={d.winRate >= 50 ? "text-gold" : "text-loss"}>
                              {d.winRate}%
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("tooltips.gameNumber", { index: d.index })}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    y={50}
                    stroke={cc.chartReference}
                    strokeDasharray="3 3"
                    label={{ value: "50%", fill: cc.chartAxis, fontSize: 11 }}
                  />
                  {/* Shaded bands between coaching sessions */}
                  {coachingBands.bands.map((band, i) => (
                    <ReferenceArea
                      key={`band-${i}`}
                      x1={band.x1}
                      x2={band.x2}
                      fill={cc.neonPurple}
                      fillOpacity={band.isOngoing ? 0.08 : 0.12}
                      strokeOpacity={0}
                    />
                  ))}
                  {/* Coaching session markers */}
                  {coachingBands.sessionIndices.map((s, i) => (
                    <ReferenceLine
                      key={`session-${i}`}
                      x={s.index}
                      stroke={cc.neonPurple}
                      strokeOpacity={s.status === "scheduled" ? 0.6 : 1}
                      strokeDasharray={s.status === "scheduled" ? "6 4" : "4 4"}
                      label={{
                        value: s.coachName,
                        fill: cc.neonPurple,
                        fontSize: 10,
                        position: "top",
                      }}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="winRate"
                    stroke={cc.gold}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Matchup Win Rates */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle>{t("matchupWinRates")}</CardTitle>
            <CardDescription>{t("topMatchupsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {topMatchups.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noMatchupData")}</p>
            ) : (
              <div style={{ height: Math.max(200, topMatchups.length * 40 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topMatchups} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={cc.chartGrid} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      stroke={cc.chartAxis}
                      fontSize={12}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      stroke={cc.chartAxis}
                      fontSize={12}
                      tick={({
                        x,
                        y,
                        payload,
                      }: {
                        x: string | number;
                        y: string | number;
                        payload: { value: string };
                      }) => (
                        <a href={`/scout?enemy=${encodeURIComponent(payload.value)}`}>
                          <g transform={`translate(${x},${y})`} style={{ cursor: "pointer" }}>
                            <image
                              href={getLocalChampionIconUrl(payload.value, 20)}
                              x={-98}
                              y={-10}
                              width={20}
                              height={20}
                              clipPath="inset(0 round 2px)"
                            />
                            <text
                              x={-74}
                              y={0}
                              dy={4}
                              fill={cc.mutedForeground}
                              fontSize={12}
                              textAnchor="start"
                            >
                              {payload.value}
                            </text>
                          </g>
                        </a>
                      )}
                    />
                    <Tooltip
                      cursor={{ fill: `color-mix(in oklch, ${cc.chartGrid}, transparent 70%)` }}
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload[0]) return null;
                        const d = payload[0].payload as MatchupStat;
                        return (
                          <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 shadow-lg">
                            <p className="font-semibold text-foreground">{d.name}</p>
                            <p className="text-sm">
                              Win Rate:{" "}
                              <span className={d.winRate >= 50 ? "text-gold" : "text-loss"}>
                                {d.winRate}%
                              </span>{" "}
                              <span className="text-muted-foreground">
                                ({d.wins}W {d.losses}L / {d.games} games)
                              </span>
                            </p>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine x={50} stroke={cc.chartReference} strokeDasharray="3 3" />
                    <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                      {topMatchups.map((entry, index) => (
                        <Cell key={index} fill={entry.winRate >= 50 ? cc.gold : cc.loss} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        {children}
      </div>
    </>
  );
}

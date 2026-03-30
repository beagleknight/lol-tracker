"use client";

import { useTheme } from "next-themes";
import { useCallback, useSyncExternalStore } from "react";

/**
 * Reads computed CSS variable values so they can be passed as color strings
 * to Recharts (which only accepts inline color values, not CSS custom
 * properties).
 *
 * Re-reads on theme change so charts update when toggling light/dark.
 */

export interface ChartColors {
  gold: string;
  goldLight: string;
  goldDark: string;
  electric: string;
  neonPurple: string;
  chartGrid: string;
  chartAxis: string;
  chartTooltipBg: string;
  chartTooltipBorder: string;
  chartReference: string;
  chartPromotion: string;
  chartDemotion: string;
  background: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  surfaceElevated: string;
  win: string;
  loss: string;
}

function readColors(): ChartColors {
  if (typeof window === "undefined") return {} as ChartColors;
  const cs = getComputedStyle(document.documentElement);
  const read = (varName: string) => cs.getPropertyValue(varName).trim();

  return {
    gold: read("--gold"),
    goldLight: read("--gold-light"),
    goldDark: read("--gold-dark"),
    electric: read("--electric"),
    neonPurple: read("--neon-purple"),
    chartGrid: read("--chart-grid"),
    chartAxis: read("--chart-axis"),
    chartTooltipBg: read("--chart-tooltip-bg"),
    chartTooltipBorder: read("--chart-tooltip-border"),
    chartReference: read("--chart-reference"),
    chartPromotion: read("--chart-promotion"),
    chartDemotion: read("--chart-demotion"),
    background: read("--background"),
    foreground: read("--foreground"),
    mutedForeground: read("--muted-foreground"),
    border: read("--border"),
    surfaceElevated: read("--surface-elevated"),
    win: read("--win"),
    loss: read("--loss"),
  };
}

// Module-level cache so useSyncExternalStore can return a stable reference
let cachedColors: ChartColors = {} as ChartColors;
let cachedTheme: string | undefined;

export function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme();

  const subscribe = useCallback(() => {
    // No external subscription needed — we re-snapshot via getSnapshot
    return () => {};
  }, []);

  const getSnapshot = useCallback(() => {
    // Only re-read CSS when the theme actually changes
    if (resolvedTheme !== cachedTheme) {
      cachedTheme = resolvedTheme;
      cachedColors = readColors();
    }
    return cachedColors;
  }, [resolvedTheme]);

  const getServerSnapshot = useCallback(() => ({}) as ChartColors, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

"use client";

// Shared UI components for rendering match results consistently.
// Replaces 7+ copy-pasted Badge ternaries and 5+ bar ternaries across the app.

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type MatchResult,
  resultBadgeVariant,
  resultBarColor,
} from "@/lib/match-result";

// ─── ResultBadge ─────────────────────────────────────────────────────────────

type ResultFormat =
  | "short" // "W" / "L" / "R"
  | "long" // "Victory" / "Defeat" / "Remake" (localized)
  | "raw"; // Uses the raw result string as-is (e.g. "Victory")

interface ResultBadgeProps {
  result: MatchResult | string;
  /** "short" → W/L/R, "long" → Victory/Defeat/Remake, "raw" → raw string */
  format?: ResultFormat;
  className?: string;
}

export function ResultBadge({
  result,
  format = "short",
  className,
}: ResultBadgeProps) {
  const t = useTranslations("Common");
  const variant = resultBadgeVariant(result);

  let label: string;
  if (format === "raw") {
    label = result;
  } else if (format === "long") {
    label =
      result === "Victory"
        ? t("resultVictory")
        : result === "Remake"
          ? t("resultRemake")
          : t("resultDefeat");
  } else {
    // short
    label =
      result === "Victory"
        ? t("resultW")
        : result === "Remake"
          ? t("resultR")
          : t("resultL");
  }

  return (
    <Badge variant={variant} className={cn("text-xs", className)}>
      {label}
    </Badge>
  );
}

// ─── ResultBar ───────────────────────────────────────────────────────────────

interface ResultBarProps {
  result: MatchResult | string;
  /** Height class — "sm" = h-6, "md" = h-8, "lg" = h-10 */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const barSizeClass = {
  sm: "h-6",
  md: "h-8",
  lg: "h-10",
} as const;

export function ResultBar({
  result,
  size = "md",
  className,
}: ResultBarProps) {
  return (
    <div
      className={cn(
        "w-1 rounded-full",
        barSizeClass[size],
        resultBarColor(result),
        className
      )}
    />
  );
}

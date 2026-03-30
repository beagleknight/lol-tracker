// Centralized match result type, predicates, UI mappers, and stat helpers.
// Single source of truth for all result-related logic across the codebase.

// ─── Type ────────────────────────────────────────────────────────────────────

/** Match result as stored in the database */
export type MatchResult = "Victory" | "Defeat" | "Remake";

// ─── Predicates ──────────────────────────────────────────────────────────────

export function isWin(result: string): result is "Victory" {
  return result === "Victory";
}

export function isLoss(result: string): result is "Defeat" {
  return result === "Defeat";
}

export function isRemake(result: string): result is "Remake" {
  return result === "Remake";
}

/** A "meaningful" game is one that isn't a remake — it counts for stats. */
export function isMeaningful(result: string): result is "Victory" | "Defeat" {
  return result === "Victory" || result === "Defeat";
}

// ─── Filtering ───────────────────────────────────────────────────────────────

/** Filter an array of items to only those with meaningful (non-remake) results. */
export function filterMeaningful<T extends { result: string }>(items: T[]): T[] {
  return items.filter((item) => isMeaningful(item.result));
}

// ─── UI Mappers ──────────────────────────────────────────────────────────────

/** Badge variant for match result badges (maps to Badge component variants). */
export function resultBadgeVariant(result: string): "default" | "secondary" | "destructive" {
  if (isWin(result)) return "default";
  if (isRemake(result)) return "secondary";
  return "destructive";
}

/** Color bar class for the vertical result indicator strip. */
export function resultBarColor(result: string): string {
  if (isWin(result)) return "bg-win";
  if (isRemake(result)) return "bg-muted-foreground/40";
  return "bg-loss";
}

/** Border color class for match cards with left border. */
export function resultBorderColor(result: string): string {
  if (isWin(result)) return "border-l-win/60";
  if (isRemake(result)) return "border-l-muted-foreground/40";
  return "border-l-loss/60";
}

// ─── Stats ───────────────────────────────────────────────────────────────────

/** Compute win rate as an integer percentage (0–100). Returns 0 if no games. */
export function computeWinRate(wins: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((wins / total) * 100);
}

/** Compute the current streak from a list of matches (newest first). */
export function computeStreak(
  matches: Array<{ result: string }>,
): { type: "W" | "L"; count: number } | null {
  const meaningful = matches.filter((m) => isMeaningful(m.result));
  if (meaningful.length === 0) return null;

  const first = meaningful[0].result;
  let count = 0;
  for (const m of meaningful) {
    if (m.result === first) count++;
    else break;
  }
  return { type: first === "Victory" ? "W" : "L", count };
}

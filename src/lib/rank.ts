// Shared rank utilities for League of Legends tier/division/LP calculations.
// Used by analytics, dashboard, goals, and sync logic.

export const TIER_ORDER = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;

export type Tier = (typeof TIER_ORDER)[number];

export const DIVISION_ORDER = ["IV", "III", "II", "I"] as const;

export type Division = (typeof DIVISION_ORDER)[number];

// LP per division = 100, 4 divisions per tier (except Master+ which has no divisions)
export const LP_PER_DIVISION = 100;
export const DIVISIONS_PER_TIER = 4;
export const LP_PER_TIER = LP_PER_DIVISION * DIVISIONS_PER_TIER; // 400

/**
 * Convert tier + division + lp into a single cumulative LP number.
 * Iron IV 0 LP = 0, Iron III 0 LP = 100, Bronze IV 0 LP = 400, etc.
 * Master+ tiers have no divisions, treated as division I.
 */
export function toCumulativeLP(
  tier: string | null | undefined,
  division: string | null | undefined,
  lp: number | null | undefined
): number | null {
  if (!tier) return null;
  const tierIdx = TIER_ORDER.indexOf(tier.toUpperCase() as Tier);
  if (tierIdx === -1) return null;

  // Master+ have no divisions — treat as single division
  const isMasterPlus = tierIdx >= TIER_ORDER.indexOf("MASTER");
  const divIdx = isMasterPlus
    ? 0
    : DIVISION_ORDER.indexOf((division || "IV") as Division);

  const baseLp = tierIdx * LP_PER_TIER;
  const divLp = (divIdx < 0 ? 0 : divIdx) * LP_PER_DIVISION;
  return baseLp + divLp + (lp || 0);
}

/** Get tier boundaries for reference lines within a given LP range */
export function getTierBoundaries(
  minLP: number,
  maxLP: number
): Array<{ lp: number; label: string }> {
  const boundaries: Array<{ lp: number; label: string }> = [];
  for (let i = 0; i < TIER_ORDER.length; i++) {
    const boundary = i * LP_PER_TIER;
    if (boundary > minLP && boundary < maxLP) {
      const tierName =
        TIER_ORDER[i].charAt(0) + TIER_ORDER[i].slice(1).toLowerCase();
      boundaries.push({ lp: boundary, label: tierName });
    }
  }
  return boundaries;
}

/** Format cumulative LP back to human-readable rank string */
export function formatRank(cumulativeLP: number): string {
  const tierIdx = Math.min(
    Math.floor(cumulativeLP / LP_PER_TIER),
    TIER_ORDER.length - 1
  );
  const tier = TIER_ORDER[tierIdx];
  const tierName = tier.charAt(0) + tier.slice(1).toLowerCase();

  const isMasterPlus = tierIdx >= TIER_ORDER.indexOf("MASTER");
  if (isMasterPlus) {
    const lp = cumulativeLP - tierIdx * LP_PER_TIER;
    return `${tierName} ${lp} LP`;
  }

  const lpInTier = cumulativeLP - tierIdx * LP_PER_TIER;
  const divIdx = Math.min(Math.floor(lpInTier / LP_PER_DIVISION), 3);
  const division = DIVISION_ORDER[divIdx];
  const lp = lpInTier - divIdx * LP_PER_DIVISION;
  return `${tierName} ${division} — ${lp} LP`;
}

/**
 * Format tier + division into a short display string.
 * e.g. "PLATINUM", "IV" → "Platinum IV"
 * e.g. "MASTER", null → "Master"
 */
export function formatTierDivision(
  tier: string,
  division: string | null | undefined
): string {
  const tierName = tier.charAt(0) + tier.slice(1).toLowerCase();
  const tierIdx = TIER_ORDER.indexOf(tier.toUpperCase() as Tier);
  const isMasterPlus = tierIdx >= TIER_ORDER.indexOf("MASTER");
  if (isMasterPlus || !division) return tierName;
  return `${tierName} ${division}`;
}

/**
 * Check whether a current rank has reached or exceeded a target rank.
 * Compares cumulative LP of both positions.
 */
export function hasReachedTarget(
  currentTier: string,
  currentDivision: string | null,
  currentLp: number,
  targetTier: string,
  targetDivision: string | null
): boolean {
  const currentCum = toCumulativeLP(currentTier, currentDivision, currentLp);
  // Target is "reaching" the division, so 0 LP in that division counts
  const targetCum = toCumulativeLP(targetTier, targetDivision, 0);
  if (currentCum === null || targetCum === null) return false;
  return currentCum >= targetCum;
}

/**
 * Calculate progress percentage from start rank to target rank given current rank.
 * Returns a number 0-100, clamped.
 */
export function calculateProgress(
  startTier: string,
  startDivision: string | null,
  startLp: number,
  currentTier: string,
  currentDivision: string | null,
  currentLp: number,
  targetTier: string,
  targetDivision: string | null
): number {
  const startCum = toCumulativeLP(startTier, startDivision, startLp);
  const currentCum = toCumulativeLP(currentTier, currentDivision, currentLp);
  const targetCum = toCumulativeLP(targetTier, targetDivision, 0);

  if (startCum === null || currentCum === null || targetCum === null) return 0;
  if (targetCum <= startCum) return 100; // Target is at or below start

  const progress = ((currentCum - startCum) / (targetCum - startCum)) * 100;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

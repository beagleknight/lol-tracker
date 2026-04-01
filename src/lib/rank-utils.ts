/**
 * Rank-tier visual utilities — colors, emblems, and Tailwind class helpers.
 *
 * Emblem images come from Community Dragon (CDragon) which hosts the
 * official ranked emblems without requiring an API key.
 */

export type RankTier =
  | "IRON"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "EMERALD"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

/**
 * Map a rank tier string to its Tailwind color class name.
 * Uses the custom `rank-*` tokens defined in globals.css.
 */
const TIER_COLOR_MAP: Record<RankTier, string> = {
  IRON: "rank-iron",
  BRONZE: "rank-bronze",
  SILVER: "rank-silver",
  GOLD: "rank-gold",
  PLATINUM: "rank-platinum",
  EMERALD: "rank-emerald",
  DIAMOND: "rank-diamond",
  MASTER: "rank-master",
  GRANDMASTER: "rank-grandmaster",
  CHALLENGER: "rank-challenger",
};

/** Returns the Tailwind color token name (e.g. "rank-gold") for a tier. */
export function getRankColorToken(tier: string): string {
  const normalized = tier.toUpperCase() as RankTier;
  return TIER_COLOR_MAP[normalized] ?? "rank-gold";
}

/** Returns Tailwind text color class for a given tier string. */
export function getRankTextClass(tier: string): string {
  return `text-${getRankColorToken(tier)}`;
}

/** Returns Tailwind border color class for a given tier string. */
export function getRankBorderClass(tier: string): string {
  return `border-${getRankColorToken(tier)}`;
}

/**
 * Get the rank emblem image URL from Community Dragon (CDragon).
 * These are the official Riot ranked emblems hosted on a public CDN.
 *
 * @see https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/
 */
export function getRankEmblemUrl(tier: string): string {
  const normalized = tier.toLowerCase();
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${normalized}.png`;
}

/**
 * Returns the CSS custom property value reference for a tier.
 * Useful for inline styles where Tailwind classes can't be used dynamically.
 */
export function getRankCssVar(tier: string): string {
  const normalized = tier.toUpperCase() as RankTier;
  const token = TIER_COLOR_MAP[normalized] ?? "rank-gold";
  return `var(--${token})`;
}

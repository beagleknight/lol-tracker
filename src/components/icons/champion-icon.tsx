import { getLocalChampionIconUrl } from "@/lib/ddragon-assets";

/**
 * Shared champion icon component. Renders a self-hosted, pre-optimized
 * champion icon at the exact requested display size.
 *
 * Used across match cards, scout, duo, coaching, and analytics pages —
 * replaces the three duplicate local ChampionIcon components that existed before.
 */
export function ChampionIcon({
  championName,
  size = 28,
  className = "rounded",
}: {
  championName: string;
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-optimized local assets, no next/image needed
    <img
      src={getLocalChampionIconUrl(championName, size)}
      alt={championName}
      width={size}
      height={size}
      className={className}
    />
  );
}

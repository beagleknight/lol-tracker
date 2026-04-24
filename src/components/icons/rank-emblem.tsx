import { getLocalRankEmblemUrl } from "@/lib/ddragon-assets";

/**
 * Shared rank emblem component. Renders a self-hosted, pre-optimized
 * ranked emblem icon (iron through challenger).
 */
export function RankEmblem({
  tier,
  alt,
  size = 48,
  className = "shrink-0 drop-shadow-md",
}: {
  tier: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-optimized local assets, no next/image needed
    <img
      src={getLocalRankEmblemUrl(tier, size)}
      alt={alt}
      width={size}
      height={size}
      className={className}
    />
  );
}

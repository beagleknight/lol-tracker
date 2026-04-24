import Image from "next/image";

import { getLocalRankEmblemUrl } from "@/lib/ddragon-assets";

/**
 * Shared rank emblem component. Renders a self-hosted, pre-optimized WebP
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
    <Image
      src={getLocalRankEmblemUrl(tier, size)}
      alt={alt}
      width={size}
      height={size}
      className={className}
    />
  );
}

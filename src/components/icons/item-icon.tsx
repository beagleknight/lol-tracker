import Image from "next/image";

import { getLocalItemIconUrl } from "@/lib/ddragon-assets";

/**
 * Shared item icon component. Renders a self-hosted, pre-optimized WebP
 * item icon at the requested display size (currently only 24px is used).
 */
export function ItemIcon({
  itemId,
  alt,
  size = 24,
  className = "rounded",
}: {
  itemId: number;
  alt: string;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={getLocalItemIconUrl(itemId, size)}
      alt={alt}
      width={size}
      height={size}
      className={className}
    />
  );
}

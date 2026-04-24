import Image from "next/image";

import { getLocalRuneIconUrl, getLocalRuneIconUrlByName } from "@/lib/ddragon-assets";

/**
 * Shared rune/keystone icon component. Renders a self-hosted, pre-optimized
 * WebP keystone rune icon.
 *
 * Accepts either `keystoneId` (preferred) or `keystoneName` for reverse-lookup.
 * Returns null if the name is unknown and no ID was provided.
 */
export function RuneIcon({
  keystoneId,
  keystoneName,
  alt,
  size,
  className = "rounded",
}: {
  keystoneId?: number | null;
  keystoneName?: string | null;
  alt: string;
  size: number;
  className?: string;
}) {
  let src: string | null = null;
  if (keystoneId) {
    src = getLocalRuneIconUrl(keystoneId, size);
  } else if (keystoneName) {
    src = getLocalRuneIconUrlByName(keystoneName, size);
  }

  if (!src) return null;

  return <Image src={src} alt={alt} width={size} height={size} className={className} />;
}

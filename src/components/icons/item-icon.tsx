import { getLocalItemIconUrl } from "@/lib/ddragon-assets";

/**
 * Shared item icon component. Renders a self-hosted, pre-optimized
 * item icon at the requested display size.
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
    // eslint-disable-next-line @next/next/no-img-element -- pre-optimized local assets, no next/image needed
    <img
      src={getLocalItemIconUrl(itemId, size)}
      alt={alt}
      width={size}
      height={size}
      className={className}
    />
  );
}

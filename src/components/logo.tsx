import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Custom LoL Tracker logo — a stylized diamond/shield with an integrated
 * crosshair reticle, evoking ranked-play precision. Works at any size via
 * the standard `className` width/height utilities.
 */
export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-6 w-6", className)}
      {...props}
    >
      {/* Outer diamond / shield shape */}
      <path d="M12 2 L22 9 L18 22 L6 22 L2 9 Z" />

      {/* Inner diamond accent */}
      <path d="M12 6 L17 10.5 L15 18 L9 18 L7 10.5 Z" strokeWidth="1" opacity="0.6" />

      {/* Vertical crosshair */}
      <line x1="12" y1="8" x2="12" y2="16" strokeWidth="1.5" />

      {/* Horizontal crosshair */}
      <line x1="8" y1="12" x2="16" y2="12" strokeWidth="1.5" />

      {/* Center dot — the target */}
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

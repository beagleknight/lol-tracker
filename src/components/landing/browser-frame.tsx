import Image from "next/image";

import { cn } from "@/lib/utils";

interface BrowserFrameProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

export function BrowserFrame({ src, alt, width, height, className, priority }: BrowserFrameProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/50 bg-card shadow-2xl",
        className,
      )}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-border/50 bg-muted/50 px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500/70" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
          <div className="h-3 w-3 rounded-full bg-green-500/70" />
        </div>
        <div className="mx-auto flex-1 text-center">
          <div className="mx-auto max-w-xs rounded-md bg-background/50 px-3 py-1 text-xs text-muted-foreground">
            lol-tracker-sigma.vercel.app
          </div>
        </div>
      </div>
      {/* Screenshot */}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="block w-full"
        priority={priority}
      />
    </div>
  );
}

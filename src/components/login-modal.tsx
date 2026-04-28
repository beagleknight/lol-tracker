"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A modal wrapper for the intercepted login route.
 * Always renders open and navigates back on close (dismissing the overlay).
 * Automatically hides when the pathname changes away from /login
 * (e.g. after successful login redirects to /dashboard).
 */
export function LoginModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Hide the modal if the user has navigated away from /login
  // (parallel slot preserves state during soft navigation)
  if (pathname !== "/login") {
    return null;
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      router.back();
    }
  }

  return (
    <DialogPrimitive.Root open onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 isolate z-50 bg-black/60 duration-100 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          )}
        />
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex items-center justify-center">
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

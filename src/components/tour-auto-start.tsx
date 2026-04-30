"use client";

import { useTour } from "@/hooks/use-tour";

/**
 * Invisible component that auto-starts the guided tour on first visit.
 * Mount this once on the dashboard page.
 */
export function TourAutoStart() {
  useTour({ autoStart: true });
  return null;
}

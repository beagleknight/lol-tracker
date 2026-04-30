"use client";

import { useTranslations } from "next-intl";

import { useTour } from "@/hooks/use-tour";
import { useSidebarTourSteps } from "@/lib/tour-steps";

/**
 * Invisible component that auto-starts the global sidebar tour on first visit.
 * Mount this once on the dashboard page.
 */
export function TourAutoStart() {
  const t = useTranslations("Tour");
  const steps = useSidebarTourSteps(t);
  useTour({ id: "sidebar", steps, autoStart: true });
  return null;
}

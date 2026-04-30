"use client";

import { driver, type DriveStep } from "driver.js";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

const TOUR_COMPLETED_KEY = "tour-completed";

/**
 * Guided tour hook powered by Driver.js.
 *
 * - On first call after onboarding, auto-starts the tour (unless already completed).
 * - Exposes `startTour()` so the Settings page can re-trigger it.
 */
export function useTour({ autoStart = false }: { autoStart?: boolean } = {}) {
  const t = useTranslations("Tour");
  const started = useRef(false);

  const buildSteps = useCallback((): DriveStep[] => {
    return [
      {
        element: "[data-tour='sync-button']",
        popover: {
          title: t("stepSyncTitle"),
          description: t("stepSyncDescription"),
          side: "bottom" as const,
          align: "end" as const,
        },
      },
      {
        element: "[data-tour='section-tracker']",
        popover: {
          title: t("stepTrackerTitle"),
          description: t("stepTrackerDescription"),
          side: "right" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='section-insights']",
        popover: {
          title: t("stepInsightsTitle"),
          description: t("stepInsightsDescription"),
          side: "right" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='section-coaching']",
        popover: {
          title: t("stepCoachingTitle"),
          description: t("stepCoachingDescription"),
          side: "right" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='season-filter']",
        popover: {
          title: t("stepSeasonFilterTitle"),
          description: t("stepSeasonFilterDescription"),
          side: "bottom" as const,
          align: "start" as const,
        },
      },
    ];
  }, [t]);

  const startTour = useCallback(() => {
    const driverInstance = driver({
      showProgress: true,
      animate: true,
      overlayColor: "hsl(228 10% 5% / 0.75)",
      popoverClass: "levelrise-tour-popover",
      nextBtnText: t("nextButton"),
      prevBtnText: t("prevButton"),
      doneBtnText: t("doneButton"),
      progressText: "{{current}} / {{total}}",
      steps: buildSteps(),
      onDestroyStarted: () => {
        // User clicked the X or clicked outside — treat as skip
        if (!driverInstance.hasNextStep()) {
          // Last step — completed
          localStorage.setItem(TOUR_COMPLETED_KEY, "true");
          toast.success(t("toastCompleted"));
        } else {
          localStorage.setItem(TOUR_COMPLETED_KEY, "true");
          toast.info(t("toastSkipped"));
        }
        driverInstance.destroy();
      },
    });

    driverInstance.drive();
  }, [buildSteps, t]);

  // Auto-start on mount if requested and not yet completed
  useEffect(() => {
    if (!autoStart || started.current) return;
    const completed = localStorage.getItem(TOUR_COMPLETED_KEY);
    if (completed) return;

    started.current = true;
    // Small delay to let the sidebar render fully
    const timer = setTimeout(() => {
      startTour();
    }, 500);
    return () => clearTimeout(timer);
  }, [autoStart, startTour]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_COMPLETED_KEY);
    startTour();
  }, [startTour]);

  return { startTour, resetTour };
}

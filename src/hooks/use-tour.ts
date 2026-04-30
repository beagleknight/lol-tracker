"use client";

import { driver, type DriveStep } from "driver.js";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

function tourKey(id: string) {
  return `tour-${id}-completed`;
}

interface UseTourOptions {
  /** Unique identifier for this tour (used as localStorage key) */
  id: string;
  /** Tour steps — when omitted, the global sidebar steps are used */
  steps: DriveStep[];
  /** Auto-start on first mount if not yet completed */
  autoStart?: boolean;
  /** i18n namespace for toast messages (defaults to "Tour") */
  toastCompleted?: string;
  toastSkipped?: string;
}

/**
 * Guided tour hook powered by Driver.js.
 *
 * Supports named tours so each page can have its own independent tour
 * with separate completion state in localStorage.
 */
export function useTour({
  id,
  steps,
  autoStart = false,
  toastCompleted: toastCompletedOverride,
  toastSkipped: toastSkippedOverride,
}: UseTourOptions) {
  const t = useTranslations("Tour");
  const started = useRef(false);

  const completedMsg = toastCompletedOverride ?? t("toastCompleted");
  const skippedMsg = toastSkippedOverride ?? t("toastSkipped");

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
      steps,
      onDestroyStarted: () => {
        if (!driverInstance.hasNextStep()) {
          localStorage.setItem(tourKey(id), "true");
          toast.success(completedMsg);
        } else {
          localStorage.setItem(tourKey(id), "true");
          toast.info(skippedMsg);
        }
        driverInstance.destroy();
      },
    });

    driverInstance.drive();
  }, [steps, t, id, completedMsg, skippedMsg]);

  // Auto-start on mount if requested and not yet completed
  useEffect(() => {
    if (!autoStart || started.current) return;
    const completed = localStorage.getItem(tourKey(id));
    if (completed) return;

    started.current = true;
    const timer = setTimeout(() => {
      startTour();
    }, 500);
    return () => clearTimeout(timer);
  }, [autoStart, startTour, id]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(tourKey(id));
    startTour();
  }, [startTour, id]);

  return { startTour, resetTour };
}

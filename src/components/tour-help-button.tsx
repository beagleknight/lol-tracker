"use client";

import type { DriveStep } from "driver.js";

import { CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useTour } from "@/hooks/use-tour";

interface TourHelpButtonProps {
  /** Unique tour identifier */
  tourId: string;
  /** Tour steps for this page */
  steps: DriveStep[];
  /** Auto-start on first visit (defaults to true) */
  autoStart?: boolean;
}

/**
 * Small contextual help button for page headers.
 * Auto-starts the tour on first visit and allows replay on click.
 */
export function TourHelpButton({ tourId, steps, autoStart = true }: TourHelpButtonProps) {
  const t = useTranslations("Tour");
  const { resetTour } = useTour({ id: tourId, steps, autoStart });

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={resetTour}
      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-teal"
      aria-label={t("helpButton")}
      title={t("helpButton")}
    >
      <CircleHelp className="h-4 w-4" />
    </Button>
  );
}

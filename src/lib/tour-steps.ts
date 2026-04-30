import type { DriveStep } from "driver.js";

import { useMemo } from "react";

type T = (key: string) => string;

/** Global sidebar tour steps */
export function useSidebarTourSteps(t: T): DriveStep[] {
  return useMemo(
    () => [
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
    ],
    [t],
  );
}

/** Review page tour steps */
export function useReviewTourSteps(t: T): DriveStep[] {
  return useMemo(
    () => [
      {
        element: "[data-tour='review-tabs']",
        popover: {
          title: t("reviewTabsTitle"),
          description: t("reviewTabsDescription"),
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='review-pending-card']",
        popover: {
          title: t("reviewCardTitle"),
          description: t("reviewCardDescription"),
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='review-sort']",
        popover: {
          title: t("reviewSortTitle"),
          description: t("reviewSortDescription"),
          side: "bottom" as const,
          align: "end" as const,
        },
      },
    ],
    [t],
  );
}

/** Matches page tour steps */
export function useMatchesTourSteps(t: T): DriveStep[] {
  return useMemo(
    () => [
      {
        element: "[data-tour='matches-filters']",
        popover: {
          title: t("matchesFiltersTitle"),
          description: t("matchesFiltersDescription"),
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='matches-list']",
        popover: {
          title: t("matchesListTitle"),
          description: t("matchesListDescription"),
          side: "top" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='matches-export']",
        popover: {
          title: t("matchesExportTitle"),
          description: t("matchesExportDescription"),
          side: "bottom" as const,
          align: "end" as const,
        },
      },
    ],
    [t],
  );
}

/** Matchup scout page tour steps */
export function useScoutTourSteps(t: T): DriveStep[] {
  return useMemo(
    () => [
      {
        element: "[data-tour='scout-your-champion']",
        popover: {
          title: t("scoutYourChampionTitle"),
          description: t("scoutYourChampionDescription"),
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='scout-enemy-champion']",
        popover: {
          title: t("scoutEnemyChampionTitle"),
          description: t("scoutEnemyChampionDescription"),
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='scout-report']",
        popover: {
          title: t("scoutReportTitle"),
          description: t("scoutReportDescription"),
          side: "top" as const,
          align: "start" as const,
        },
      },
    ],
    [t],
  );
}

/** Coaching page tour steps */
export function useCoachingTourSteps(t: T): DriveStep[] {
  return useMemo(
    () => [
      {
        element: "[data-tour='coaching-new-session']",
        popover: {
          title: t("coachingNewSessionTitle"),
          description: t("coachingNewSessionDescription"),
          side: "bottom" as const,
          align: "end" as const,
        },
      },
      {
        element: "[data-tour='coaching-upcoming']",
        popover: {
          title: t("coachingUpcomingTitle"),
          description: t("coachingUpcomingDescription"),
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='coaching-action-items']",
        popover: {
          title: t("coachingActionItemsTitle"),
          description: t("coachingActionItemsDescription"),
          side: "top" as const,
          align: "start" as const,
        },
      },
    ],
    [t],
  );
}

/** Challenges page tour steps */
export function useChallengesTourSteps(t: T): DriveStep[] {
  return useMemo(
    () => [
      {
        element: "[data-tour='challenges-new']",
        popover: {
          title: t("challengesNewTitle"),
          description: t("challengesNewDescription"),
          side: "bottom" as const,
          align: "end" as const,
        },
      },
      {
        element: "[data-tour='challenges-tabs']",
        popover: {
          title: t("challengesTabsTitle"),
          description: t("challengesTabsDescription"),
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: "[data-tour='challenges-active-card']",
        popover: {
          title: t("challengesCardTitle"),
          description: t("challengesCardDescription"),
          side: "bottom" as const,
          align: "start" as const,
        },
      },
    ],
    [t],
  );
}

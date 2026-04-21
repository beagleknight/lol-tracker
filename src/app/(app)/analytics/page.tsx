import { cacheLife, cacheTag } from "next/cache";

import { analyticsTag, challengesTag } from "@/lib/cache";
import { getAnalyticsData } from "@/lib/queries/analytics";
import { requireUser } from "@/lib/session";

import { AnalyticsClient } from "./analytics-client";

async function getCachedAnalyticsData(userId: string, riotAccountId: string | null) {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(analyticsTag(userId), challengesTag(userId));

  return getAnalyticsData(userId, riotAccountId);
}

export default async function AnalyticsPage() {
  const user = await requireUser();
  const { allMatches, sessions, ranks, ddragonVersion, activeGoal } = await getCachedAnalyticsData(
    user.id,
    user.activeRiotAccountId,
  );

  return (
    <AnalyticsClient
      matches={allMatches}
      coachingSessions={sessions}
      rankSnapshots={ranks}
      ddragonVersion={ddragonVersion}
      activeGoal={activeGoal}
    />
  );
}

import { cacheLife, cacheTag } from "next/cache";

import type { DateRange } from "@/lib/seasons";

import { analyticsTag, challengesTag } from "@/lib/cache";
import { getAnalyticsData } from "@/lib/queries/analytics";
import { getSeasonDateRange } from "@/lib/season-filter";
import { requireUser } from "@/lib/session";

import { AnalyticsClient } from "./analytics-client";

async function getCachedAnalyticsData(
  userId: string,
  riotAccountId: string | null,
  dateRange: DateRange | null,
) {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(analyticsTag(userId), challengesTag(userId));

  return getAnalyticsData(userId, riotAccountId, dateRange);
}

export default async function AnalyticsPage() {
  const user = await requireUser();
  const dateRange = await getSeasonDateRange();
  const data = await getCachedAnalyticsData(user.id, user.activeRiotAccountId, dateRange);

  return <AnalyticsClient data={data} />;
}

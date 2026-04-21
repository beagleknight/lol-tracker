import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AnalyticsClient } from "@/app/(app)/analytics/analytics-client";
import { getDemoUser } from "@/lib/demo-user";
import { getAnalyticsData } from "@/lib/queries/analytics";

export default async function DemoAnalyticsPage() {
  await connection();
  const user = await getDemoUser();
  if (!user) redirect("/login");

  const { allMatches, sessions, ranks, ddragonVersion, activeGoal } = await getAnalyticsData(
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
      readOnly
    />
  );
}

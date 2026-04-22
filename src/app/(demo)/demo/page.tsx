import { notFound } from "next/navigation";
import { connection } from "next/server";

import { DashboardClient } from "@/app/(app)/dashboard/dashboard-client";
import { getDemoUser } from "@/lib/demo-user";
import { getDashboardData } from "@/lib/queries/dashboard";

export default async function DemoDashboardPage() {
  await connection();
  const user = await getDemoUser();
  if (!user) notFound();

  const data = await getDashboardData(user.id, user.activeRiotAccountId);

  return (
    <DashboardClient
      user={{
        name: user.name,
        riotGameName: user.riotGameName,
        riotTagLine: user.riotTagLine,
        isRiotLinked: !!user.puuid,
      }}
      recentMatches={data.recentMatches}
      highlightsPerMatch={data.highlightsPerMatch}
      matchStats={data.matchStats}
      latestRank={data.latestRank}
      lpTrend={data.lpTrend}
      lpTrendDays={data.lpTrendDays}
      actionItems={data.actionItems}
      upcomingSession={data.upcomingSession}
      activeChallenges={data.activeChallenges}
      lastCompletedSession={data.lastCompletedSession}
      daysSinceLastCoaching={data.daysSinceLastCoaching}
      coachingCadenceDays={user.coachingCadenceDays}
      currentRank={data.currentRank}
      ddragonVersion={data.ddragonVersion}
      topicNames={data.topicNames}
      readOnly
    />
  );
}

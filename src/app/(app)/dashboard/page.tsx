import { getDashboardData } from "@/lib/queries/dashboard";
import { getSeasonDateRange } from "@/lib/season-filter";
import { requireUser } from "@/lib/session";

import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const user = await requireUser();
  const dateRange = await getSeasonDateRange();
  const data = await getDashboardData(user.id, user.activeRiotAccountId, dateRange);

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
    />
  );
}

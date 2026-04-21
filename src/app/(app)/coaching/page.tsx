import { cacheLife, cacheTag } from "next/cache";

import { coachingTag } from "@/lib/cache";
import { getCoachingData } from "@/lib/queries/coaching";
import { requireUser } from "@/lib/session";

import { CoachingHubClient } from "./coaching-hub-client";

async function getCachedCoachingHubData(userId: string, riotAccountId: string | null) {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(coachingTag(userId));

  return getCoachingData(userId, riotAccountId);
}

export default async function CoachingHubPage() {
  const user = await requireUser();
  const data = await getCachedCoachingHubData(user.id, user.activeRiotAccountId);

  return (
    <CoachingHubClient
      scheduledSessions={data.scheduledSessions}
      completedSessions={data.completedSessions}
      activeActionItems={data.activeActionItems}
      actionItemsBySession={data.actionItemsBySession}
      vodMatchMap={data.vodMatchMap}
      intervalsData={data.intervalsData}
      ddragonVersion={data.ddragonVersion}
      sessionTopics={data.sessionTopics}
      topicNames={data.topicNames}
    />
  );
}

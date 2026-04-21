import { redirect } from "next/navigation";
import { connection } from "next/server";

import { CoachingHubClient } from "@/app/(app)/coaching/coaching-hub-client";
import { getDemoUser } from "@/lib/demo-user";
import { getCoachingData } from "@/lib/queries/coaching";

export default async function DemoCoachingPage() {
  await connection();
  const user = await getDemoUser();
  if (!user) redirect("/login");

  const data = await getCoachingData(user.id, user.activeRiotAccountId);

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
      readOnly
    />
  );
}

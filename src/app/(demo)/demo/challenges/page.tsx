import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ChallengesClient } from "@/app/(app)/challenges/challenges-client";
import { getDemoUser } from "@/lib/demo-user";
import { getChallengesData } from "@/lib/queries/challenges";

export default async function DemoChallengesPage() {
  await connection();
  const user = await getDemoUser();
  if (!user) notFound();

  const data = await getChallengesData(user.id, user.activeRiotAccountId);

  return (
    <ChallengesClient
      challenges={data.challenges}
      topicsByChallenge={data.topicsByChallenge}
      currentRank={data.currentRank}
      readOnly
    />
  );
}

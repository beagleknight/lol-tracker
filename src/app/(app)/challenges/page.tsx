import { getChallengesData } from "@/lib/queries/challenges";
import { requireUser } from "@/lib/session";

import { ChallengesClient } from "./challenges-client";

export default async function ChallengesPage() {
  const user = await requireUser();
  const data = await getChallengesData(user.id, user.activeRiotAccountId);

  return (
    <ChallengesClient
      challenges={data.challenges}
      topicsByChallenge={data.topicsByChallenge}
      currentRank={data.currentRank}
    />
  );
}

import { and, eq, desc } from "drizzle-orm";

import { db } from "@/db";
import { rankSnapshots } from "@/db/schema";
import { accountScope } from "@/lib/match-queries";
import { requireUser } from "@/lib/session";
import { getTopicsForUser } from "@/lib/topics";

import { NewChallengeClient } from "./new-challenge-client";

export default async function NewChallengePage() {
  const user = await requireUser();

  const [latestSnapshot, userTopics] = await Promise.all([
    db.query.rankSnapshots.findFirst({
      where: and(
        eq(rankSnapshots.userId, user.id),
        accountScope(rankSnapshots.riotAccountId, user.activeRiotAccountId),
      ),
      orderBy: desc(rankSnapshots.capturedAt),
    }),
    getTopicsForUser(user.id),
  ]);

  return (
    <NewChallengeClient
      currentRank={
        latestSnapshot?.tier
          ? {
              tier: latestSnapshot.tier,
              division: latestSnapshot.division,
              lp: latestSnapshot.lp ?? 0,
            }
          : null
      }
      availableTopics={userTopics.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}

import { and, eq, desc, inArray } from "drizzle-orm";

import { db } from "@/db";
import { challenges, challengeTopics, topics, rankSnapshots } from "@/db/schema";
import { accountScope } from "@/lib/match-queries";
import { requireUser } from "@/lib/session";

import { ChallengesClient } from "./challenges-client";

export default async function ChallengesPage() {
  const user = await requireUser();

  const [allChallenges, latestSnapshot] = await Promise.all([
    db.query.challenges.findMany({
      where: and(
        eq(challenges.userId, user.id),
        accountScope(challenges.riotAccountId, user.activeRiotAccountId),
      ),
      orderBy: desc(challenges.createdAt),
    }),
    db.query.rankSnapshots.findFirst({
      where: and(
        eq(rankSnapshots.userId, user.id),
        accountScope(rankSnapshots.riotAccountId, user.activeRiotAccountId),
      ),
      orderBy: desc(rankSnapshots.capturedAt),
    }),
  ]);

  // Fetch topics for each challenge
  const challengeIds = allChallenges.map((c) => c.id);
  const topicLinks =
    challengeIds.length > 0
      ? await db
          .select({
            challengeId: challengeTopics.challengeId,
            topicId: topics.id,
            topicName: topics.name,
            topicSlug: topics.slug,
          })
          .from(challengeTopics)
          .innerJoin(topics, eq(challengeTopics.topicId, topics.id))
          .where(inArray(challengeTopics.challengeId, challengeIds))
      : [];

  // Group topics by challengeId
  const topicsByChallenge = new Map<number, { id: number; name: string; slug: string }[]>();
  for (const link of topicLinks) {
    const existing = topicsByChallenge.get(link.challengeId) ?? [];
    existing.push({ id: link.topicId, name: link.topicName, slug: link.topicSlug });
    topicsByChallenge.set(link.challengeId, existing);
  }

  return (
    <ChallengesClient
      challenges={allChallenges}
      topicsByChallenge={Object.fromEntries(topicsByChallenge)}
      currentRank={
        latestSnapshot?.tier
          ? {
              tier: latestSnapshot.tier,
              division: latestSnapshot.division,
              lp: latestSnapshot.lp ?? 0,
            }
          : null
      }
    />
  );
}

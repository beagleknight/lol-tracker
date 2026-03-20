import { db } from "@/db";
import { matches, coachingSessions, rankSnapshots } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { AnalyticsClient } from "./analytics-client";

export default async function AnalyticsPage() {
  const user = await requireUser();

  const allMatches = await db.query.matches.findMany({
    where: eq(matches.userId, user.id),
    orderBy: asc(matches.gameDate),
  });

  const sessions = await db.query.coachingSessions.findMany({
    where: eq(coachingSessions.userId, user.id),
    orderBy: asc(coachingSessions.date),
    columns: {
      id: true,
      coachName: true,
      date: true,
    },
  });

  const ranks = await db.query.rankSnapshots.findMany({
    where: eq(rankSnapshots.userId, user.id),
    orderBy: asc(rankSnapshots.capturedAt),
  });

  return (
    <AnalyticsClient
      matches={allMatches}
      coachingSessions={sessions}
      rankSnapshots={ranks}
    />
  );
}

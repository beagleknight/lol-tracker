import { db } from "@/db";
import { matches } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { NewSessionClient } from "./new-session-client";

export default async function NewCoachingSessionPage() {
  const user = await requireUser();

  // Get recent matches for linking
  const recentMatches = await db.query.matches.findMany({
    where: eq(matches.userId, user.id),
    orderBy: desc(matches.gameDate),
    limit: 50,
    columns: {
      id: true,
      gameDate: true,
      championName: true,
      result: true,
      matchupChampionName: true,
      kills: true,
      deaths: true,
      assists: true,
    },
  });

  return <NewSessionClient recentMatches={recentMatches} />;
}

import { db } from "@/db";
import { matches } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { NewSessionClient } from "./new-session-client";

export default async function NewCoachingSessionPage() {
  const user = await requireUser();

  const [recentMatches, ddragonVersion] = await Promise.all([
    db.query.matches.findMany({
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
    }),
    getLatestVersion(),
  ]);

  return <NewSessionClient recentMatches={recentMatches} ddragonVersion={ddragonVersion} />;
}

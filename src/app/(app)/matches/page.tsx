import { db } from "@/db";
import { matches } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { MatchesClient } from "./matches-client";

export default async function MatchesPage() {
  const user = await requireUser();

  const userMatches = await db.query.matches.findMany({
    where: eq(matches.userId, user.id),
    orderBy: desc(matches.gameDate),
  });

  const ddragonVersion = await getLatestVersion();
  const isRiotLinked = !!user.puuid;

  return (
    <MatchesClient
      matches={userMatches}
      ddragonVersion={ddragonVersion}
      isRiotLinked={isRiotLinked}
    />
  );
}

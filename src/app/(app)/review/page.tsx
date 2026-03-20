import { db } from "@/db";
import { matches } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { ReviewClient } from "./review-client";

export default async function ReviewPage() {
  const user = await requireUser();
  const ddragonVersion = await getLatestVersion();

  const unreviewedMatches = await db.query.matches.findMany({
    where: and(
      eq(matches.userId, user.id),
      eq(matches.reviewed, false)
    ),
    orderBy: desc(matches.gameDate),
  });

  return (
    <ReviewClient
      matches={unreviewedMatches}
      ddragonVersion={ddragonVersion}
    />
  );
}

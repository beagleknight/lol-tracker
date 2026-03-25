import { db } from "@/db";
import { matches } from "@/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import {
  getAllChampionNames,
  getMostPlayedChampions,
  getMostFacedOpponents,
} from "@/app/actions/live";
import { ScoutClient } from "./scout-client";

export default async function ScoutPage({
  searchParams,
}: {
  searchParams: Promise<{ your?: string; enemy?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const [
    ddragonVersion,
    allChampions,
    unreviewedResult,
    mostPlayed,
    mostFaced,
  ] = await Promise.all([
    getLatestVersion(),
    getAllChampionNames(),
    db
      .select({ value: count() })
      .from(matches)
      .where(
        sql`${matches.userId} = ${user.id} AND ${matches.reviewed} = 0`
      ),
    getMostPlayedChampions(8),
    getMostFacedOpponents(8),
  ]);

  const unreviewedCount = unreviewedResult[0]?.value ?? 0;
  const isRiotLinked = !!user.puuid;

  return (
    <ScoutClient
      ddragonVersion={ddragonVersion}
      allChampions={allChampions}
      unreviewedCount={unreviewedCount}
      isRiotLinked={isRiotLinked}
      initialYourChampion={params.your || ""}
      initialEnemyChampion={params.enemy || ""}
      mostPlayed={mostPlayed}
      mostFaced={mostFaced}
    />
  );
}

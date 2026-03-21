import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import {
  getAllChampionNames,
  getRecentUnreviewedMatch,
} from "@/app/actions/live";
import { ScoutClient } from "./scout-client";

export default async function ScoutPage({
  searchParams,
}: {
  searchParams: Promise<{ your?: string; enemy?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const [ddragonVersion, allChampions, recentUnreviewed] = await Promise.all([
    getLatestVersion(),
    getAllChampionNames(),
    getRecentUnreviewedMatch(),
  ]);

  const isRiotLinked = !!user.puuid;

  return (
    <ScoutClient
      ddragonVersion={ddragonVersion}
      allChampions={allChampions}
      recentUnreviewed={recentUnreviewed}
      isRiotLinked={isRiotLinked}
      initialYourChampion={params.your || ""}
      initialEnemyChampion={params.enemy || ""}
    />
  );
}

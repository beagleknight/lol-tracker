import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import {
  getAllChampionNames,
  getMostPlayedChampions,
  getMostFacedOpponents,
} from "@/app/actions/live";
import { checkAiConfigured } from "@/app/actions/ai-insights";
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
    mostPlayed,
    mostFaced,
    aiConfigured,
  ] = await Promise.all([
    getLatestVersion(),
    getAllChampionNames(),
    getMostPlayedChampions(8),
    getMostFacedOpponents(8),
    checkAiConfigured(),
  ]);

  const isRiotLinked = !!user.puuid;

  return (
    <ScoutClient
      ddragonVersion={ddragonVersion}
      allChampions={allChampions}
      isRiotLinked={isRiotLinked}
      initialYourChampion={params.your || ""}
      initialEnemyChampion={params.enemy || ""}
      mostPlayed={mostPlayed}
      mostFaced={mostFaced}
      isAiConfigured={aiConfigured}
    />
  );
}

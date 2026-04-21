/**
 * Shared scout page queries.
 * Extracted from (app)/scout/page.tsx for reuse in (demo)/scout/page.tsx.
 */

import { checkAiConfigured } from "@/app/actions/ai-insights";
import {
  getAllChampionNames,
  getMostPlayedChampions,
  getMostFacedOpponents,
} from "@/app/actions/live";
import { getLatestVersion } from "@/lib/riot-api";

export async function getScoutData(
  isRiotLinked: boolean,
  params: { your?: string; enemy?: string },
) {
  const [ddragonVersion, allChampions, mostPlayed, mostFaced, aiConfigured] = await Promise.all([
    getLatestVersion(),
    getAllChampionNames(),
    getMostPlayedChampions(8),
    getMostFacedOpponents(8),
    checkAiConfigured(),
  ]);

  return {
    ddragonVersion,
    allChampions,
    isRiotLinked,
    initialYourChampion: params.your || "",
    initialEnemyChampion: params.enemy || "",
    mostPlayed,
    mostFaced,
    isAiConfigured: aiConfigured,
  };
}

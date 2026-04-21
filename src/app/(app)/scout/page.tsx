import { getScoutData } from "@/lib/queries/scout";
import { requireUser } from "@/lib/session";

import { ScoutClient } from "./scout-client";

export default async function ScoutPage({
  searchParams,
}: {
  searchParams: Promise<{ your?: string; enemy?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const data = await getScoutData(!!user.puuid, params);

  return (
    <ScoutClient
      ddragonVersion={data.ddragonVersion}
      allChampions={data.allChampions}
      isRiotLinked={data.isRiotLinked}
      initialYourChampion={data.initialYourChampion}
      initialEnemyChampion={data.initialEnemyChampion}
      mostPlayed={data.mostPlayed}
      mostFaced={data.mostFaced}
      isAiConfigured={data.isAiConfigured}
    />
  );
}

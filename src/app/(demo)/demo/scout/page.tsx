import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ScoutClient } from "@/app/(app)/scout/scout-client";
import { getDemoUser } from "@/lib/demo-user";
import { getScoutData } from "@/lib/queries/scout";

export default async function DemoScoutPage({
  searchParams,
}: {
  searchParams: Promise<{ your?: string; enemy?: string }>;
}) {
  await connection();
  const user = await getDemoUser();
  if (!user) redirect("/login");

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
      readOnly
    />
  );
}

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { MatchesClient } from "@/app/(app)/matches/matches-client";
import { getDemoUser } from "@/lib/demo-user";
import { getMatchesData } from "@/lib/queries/matches";

export default async function DemoMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const user = await getDemoUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);
  const search = typeof params.search === "string" ? params.search : "";
  const result = typeof params.result === "string" ? params.result : "all";
  const champion = typeof params.champion === "string" ? params.champion : "all";
  const review = typeof params.review === "string" ? params.review : "all";

  const data = await getMatchesData(user.id, user.activeRiotAccountId, page, {
    search,
    result,
    champion,
    review,
  });

  return (
    <MatchesClient
      matches={data.matches}
      ddragonVersion={data.ddragonVersion}
      isRiotLinked={!!user.puuid}
      highlightsPerMatch={data.highlightsPerMatch}
      currentPage={data.currentPage}
      totalPages={data.totalPages}
      totalMatches={data.totalMatches}
      wins={data.wins}
      losses={data.losses}
      champions={data.champions}
      filters={data.filters}
      readOnly
    />
  );
}

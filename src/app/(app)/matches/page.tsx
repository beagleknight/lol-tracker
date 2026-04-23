import { getMatchesData } from "@/lib/queries/matches";
import { getSeasonDateRange } from "@/lib/season-filter";
import { requireUser } from "@/lib/session";

import { MatchesClient } from "./matches-client";

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const page = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);
  const search = typeof params.search === "string" ? params.search : "";
  const result = typeof params.result === "string" ? params.result : "all";
  const champion = typeof params.champion === "string" ? params.champion : "all";
  const review = typeof params.review === "string" ? params.review : "all";
  const dateRange = await getSeasonDateRange();

  const data = await getMatchesData(user.id, user.activeRiotAccountId, page, {
    search,
    result,
    champion,
    review,
    dateRange,
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
    />
  );
}

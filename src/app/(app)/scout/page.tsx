import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { getUniqueMatchupChampions, getRecentUnreviewedMatch } from "@/app/actions/live";
import { ScoutClient } from "./scout-client";

export default async function ScoutPage() {
  const user = await requireUser();

  const [ddragonVersion, matchupChampions, recentUnreviewed] =
    await Promise.all([
      getLatestVersion(),
      getUniqueMatchupChampions(),
      getRecentUnreviewedMatch(),
    ]);

  const isRiotLinked = !!user.puuid;

  return (
    <ScoutClient
      ddragonVersion={ddragonVersion}
      matchupChampions={matchupChampions}
      recentUnreviewed={recentUnreviewed}
      isRiotLinked={isRiotLinked}
    />
  );
}

import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import {
  getDuoPartnerInfo,
  getDuoStats,
  getDuoGames,
  getChampionSynergy,
} from "@/app/actions/duo";
import { DuoClient } from "./duo-client";

export default async function DuoPage() {
  const user = await requireUser();

  const [partnerInfo, stats, gamesResult, synergy, ddragonVersion] =
    await Promise.all([
      getDuoPartnerInfo(),
      getDuoStats(),
      getDuoGames(1),
      getChampionSynergy(),
      getLatestVersion(),
    ]);

  return (
    <DuoClient
      partnerInfo={partnerInfo}
      stats={stats}
      initialGames={gamesResult.games}
      initialTotalPages={gamesResult.totalPages}
      synergy={synergy}
      ddragonVersion={ddragonVersion}
      userRiotName={
        user.riotGameName
          ? `${user.riotGameName}#${user.riotTagLine}`
          : user.name || "You"
      }
    />
  );
}

"use server";

import { db } from "@/db";
import { matches, rankSnapshots } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import {
  getMatchIds,
  getMatch,
  extractPlayerData,
  findMatchupChampion,
  getKeystoneName,
  getSoloQueueEntry,
} from "@/lib/riot-api";
import { revalidatePath } from "next/cache";

export async function syncMatches() {
  const user = await requireUser();

  if (!user.puuid) {
    return { error: "Please link your Riot account first in Settings." };
  }

  try {
    // Get the most recent match date to know where to start syncing from
    const latestMatch = await db.query.matches.findFirst({
      where: eq(matches.userId, user.id),
      orderBy: desc(matches.gameDate),
    });

    const startTime = latestMatch
      ? Math.floor(latestMatch.gameDate.getTime() / 1000) + 1
      : undefined;

    // Fetch match IDs (Solo/Duo = 420)
    const matchIds = await getMatchIds(user.puuid, {
      queue: 420,
      count: 20,
      startTime,
    });

    if (matchIds.length === 0) {
      // Still capture rank snapshot even if no new games
      if (user.summonerId) {
        await captureRankSnapshot(user.id, user.summonerId);
      }
      return { synced: 0, message: "No new matches found." };
    }

    // Check which matches we already have
    const existingMatches = await db.query.matches.findMany({
      where: eq(matches.userId, user.id),
      columns: { id: true },
    });
    const existingIds = new Set(existingMatches.map((m: { id: string }) => m.id));

    // Get the current max odometer
    const maxOdoResult = await db.query.matches.findFirst({
      orderBy: desc(matches.odometer),
      columns: { odometer: true },
    });
    let nextOdometer = (maxOdoResult?.odometer || 0) + 1;

    let syncedCount = 0;

    for (const matchId of matchIds) {
      if (existingIds.has(matchId)) continue;

      try {
        const matchData = await getMatch(matchId);
        const playerData = extractPlayerData(matchData, user.puuid);

        if (!playerData) continue;

        const matchup = findMatchupChampion(matchData, user.puuid);

        await db.insert(matches).values({
          id: matchId,
          odometer: nextOdometer++,
          userId: user.id,
          gameDate: playerData.gameDate,
          result: playerData.result,
          championId: playerData.championId,
          championName: playerData.championName,
          runeKeystoneId: playerData.runeKeystoneId,
          runeKeystoneName: playerData.runeKeystoneId
            ? getKeystoneName(playerData.runeKeystoneId)
            : null,
          matchupChampionId: matchup?.championId || null,
          matchupChampionName: matchup?.championName || null,
          kills: playerData.kills,
          deaths: playerData.deaths,
          assists: playerData.assists,
          cs: playerData.cs,
          csPerMin: playerData.csPerMin,
          gameDurationSeconds: playerData.gameDurationSeconds,
          goldEarned: playerData.goldEarned,
          visionScore: playerData.visionScore,
          queueId: playerData.queueId,
          rawMatchJson: JSON.stringify(matchData),
        });

        syncedCount++;
      } catch (matchError) {
        console.error(`Failed to sync match ${matchId}:`, matchError);
        // Continue with other matches
      }

      // Small delay between API calls to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Capture rank snapshot
    if (user.summonerId) {
      await captureRankSnapshot(user.id, user.summonerId);
    }

    revalidatePath("/matches");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");

    return {
      synced: syncedCount,
      message: `Synced ${syncedCount} new match${syncedCount !== 1 ? "es" : ""}.`,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to sync matches";
    return { error: message };
  }
}

async function captureRankSnapshot(userId: string, summonerId: string) {
  try {
    const entry = await getSoloQueueEntry(summonerId);
    if (entry) {
      await db.insert(rankSnapshots).values({
        userId,
        tier: entry.tier,
        division: entry.rank,
        lp: entry.leaguePoints,
        wins: entry.wins,
        losses: entry.losses,
      });
    }
  } catch (error) {
    console.error("Failed to capture rank snapshot:", error);
  }
}

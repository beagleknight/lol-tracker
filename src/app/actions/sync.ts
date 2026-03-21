"use server";

import { db } from "@/db";
import { matches, rankSnapshots, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import {
  getMatchIds,
  getMatch,
  extractPlayerData,
  findMatchupChampion,
  findDuoPartner,
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
    // Check which matches we already have
    const existingMatches = await db.query.matches.findMany({
      where: eq(matches.userId, user.id),
      columns: { id: true },
    });
    const existingIds = new Set(existingMatches.map((m: { id: string }) => m.id));

    // Fetch all ranked match IDs via pagination (Solo/Duo = 420, max 100 per request)
    // Only fetch from Season 2026 start (January 8, 2026)
    const SEASON_START = Math.floor(new Date("2026-01-05T00:00:00Z").getTime() / 1000);
    const allMatchIds: string[] = [];
    let start = 0;
    const PAGE_SIZE = 100;

    while (true) {
      const batch = await getMatchIds(user.puuid, {
        queue: 420,
        count: PAGE_SIZE,
        start,
        startTime: SEASON_START,
      });

      if (batch.length === 0) break;

      allMatchIds.push(...batch);
      start += batch.length;

      // If we got fewer than PAGE_SIZE, there are no more results
      if (batch.length < PAGE_SIZE) break;

      // Small delay between pagination calls to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (allMatchIds.length === 0) {
      // Still capture rank snapshot even if no new games
      if (user.summonerId) {
        await captureRankSnapshot(user.id, user.summonerId);
      }
      return { synced: 0, message: "No new matches found." };
    }

    // Get the current max odometer for this user
    const maxOdoResult = await db.query.matches.findFirst({
      where: eq(matches.userId, user.id),
      orderBy: desc(matches.odometer),
      columns: { odometer: true },
    });
    let nextOdometer = (maxOdoResult?.odometer || 0) + 1;

    // Look up duo partner puuid (if user has one configured)
    let duoPartnerPuuid: string | null = null;
    if (user.duoPartnerUserId) {
      const partner = await db.query.users.findFirst({
        where: eq(users.id, user.duoPartnerUserId),
        columns: { puuid: true },
      });
      duoPartnerPuuid = partner?.puuid || null;
    }

    let syncedCount = 0;

    for (const matchId of allMatchIds) {
      if (existingIds.has(matchId)) continue;

      try {
        const matchData = await getMatch(matchId);
        const playerData = extractPlayerData(matchData, user.puuid);

        if (!playerData) continue;

        const matchup = findMatchupChampion(matchData, user.puuid);

        // Check if duo partner was on the same team
        const detectedDuoPuuid = duoPartnerPuuid
          ? findDuoPartner(matchData, user.puuid, duoPartnerPuuid)
          : null;

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
          duoPartnerPuuid: detectedDuoPuuid,
        }).onConflictDoUpdate({
          target: [matches.id, matches.userId],
          set: {
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
            duoPartnerPuuid: detectedDuoPuuid,
            syncedAt: new Date(),
          },
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
    revalidatePath("/duo");

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

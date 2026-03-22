import { db } from "@/db";
import { matches, rankSnapshots, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import {
  getMatchIds,
  getMatch,
  extractPlayerData,
  findMatchupChampion,
  findDuoPartner,
  extractDuoPartnerData,
  getKeystoneName,
  getSoloQueueEntry,
  getSummonerByPuuid,
  RiotApiError,
} from "@/lib/riot-api";

export const dynamic = "force-dynamic";

function sseMessage(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.puuid) {
    return Response.json(
      { error: "Please link your Riot account first in Settings." },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseMessage(data)));
      };

      try {
        // Auto-backfill summonerId if missing (enables rank snapshot capture)
        let effectiveSummonerId = user.summonerId;
        if (user.puuid && !user.summonerId) {
          try {
            send({ type: "status", message: "Backfilling summoner data..." });
            const summoner = await getSummonerByPuuid(user.puuid);
            await db
              .update(users)
              .set({ summonerId: summoner.id, updatedAt: new Date() })
              .where(eq(users.id, user.id));
            effectiveSummonerId = summoner.id;
          } catch (err) {
            console.error("Failed to backfill summonerId:", err);
            // Non-fatal — continue with sync, just skip rank snapshots
          }
        }

        send({ type: "status", message: "Checking existing matches..." });

        // Check which matches we already have
        const existingMatches = await db.query.matches.findMany({
          where: eq(matches.userId, user.id),
          columns: { id: true },
        });
        const existingIds = new Set(
          existingMatches.map((m: { id: string }) => m.id)
        );

        send({ type: "status", message: "Fetching match history from Riot..." });

        // Season 2026 start: January 8, 2026 (epoch seconds)
        const SEASON_START = Math.floor(new Date("2026-01-05T00:00:00Z").getTime() / 1000);

        // Fetch all ranked match IDs via pagination
        const allMatchIds: string[] = [];
        let start = 0;
        const PAGE_SIZE = 100;

        while (true) {
          const batch = await getMatchIds(user.puuid!, {
            queue: 420,
            count: PAGE_SIZE,
            start,
            startTime: SEASON_START,
          });

          if (batch.length === 0) break;

          allMatchIds.push(...batch);
          start += batch.length;

          send({
            type: "status",
            message: `Found ${allMatchIds.length} matches in history...`,
          });

          if (batch.length < PAGE_SIZE) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Filter to only new matches
        const newMatchIds = allMatchIds.filter((id) => !existingIds.has(id));

        if (newMatchIds.length === 0) {
          // Still capture rank snapshot
          let rankWarning: string | null = null;
          if (effectiveSummonerId) {
            rankWarning = await captureRankSnapshot(user.id, effectiveSummonerId);
          } else {
            rankWarning = "Rank tracking unavailable — re-link your Riot account in Settings to enable it.";
          }
          const msg = rankWarning
            ? `No new matches found. ${rankWarning}`
            : "No new matches found. Rank snapshot captured.";
          send({ type: "done", synced: 0, message: msg });
          controller.close();
          return;
        }

        // Capture rank snapshot BEFORE syncing — gives a "before" data point
        // so the LP chart shows the delta across this sync session
        if (effectiveSummonerId) {
          await captureRankSnapshot(user.id, effectiveSummonerId);
        }

        send({
          type: "status",
          message: `Syncing ${newMatchIds.length} new matches (${existingIds.size} already synced)...`,
        });

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
        let failedCount = 0;

        for (let i = 0; i < newMatchIds.length; i++) {
          const matchId = newMatchIds[i];

          try {
            const matchData = await getMatch(matchId);
            const playerData = extractPlayerData(matchData, user.puuid!);

            if (!playerData) {
              failedCount++;
              continue;
            }

            const matchup = findMatchupChampion(matchData, user.puuid!);

            // Check if duo partner was on the same team
            const detectedDuoPuuid = duoPartnerPuuid
              ? findDuoPartner(matchData, user.puuid!, duoPartnerPuuid)
              : null;

            // Extract duo partner stats for denormalized columns
            const duoPartnerData = detectedDuoPuuid
              ? extractDuoPartnerData(matchData, user.puuid!, duoPartnerPuuid!)
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
              duoPartnerChampionName: duoPartnerData?.championName ?? null,
              duoPartnerKills: duoPartnerData?.kills ?? null,
              duoPartnerDeaths: duoPartnerData?.deaths ?? null,
              duoPartnerAssists: duoPartnerData?.assists ?? null,
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
                duoPartnerChampionName: duoPartnerData?.championName ?? null,
                duoPartnerKills: duoPartnerData?.kills ?? null,
                duoPartnerDeaths: duoPartnerData?.deaths ?? null,
                duoPartnerAssists: duoPartnerData?.assists ?? null,
                syncedAt: new Date(),
              },
            });

            syncedCount++;
          } catch (matchError) {
            console.error(`Failed to sync match ${matchId}:`, matchError);
            failedCount++;
          }

          // Send progress update
          send({
            type: "progress",
            current: i + 1,
            total: newMatchIds.length,
            synced: syncedCount,
            failed: failedCount,
            message: `Syncing match ${i + 1} of ${newMatchIds.length}...`,
          });

          // Delay between API calls to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Capture rank snapshot
        let rankWarning: string | null = null;
        if (effectiveSummonerId) {
          rankWarning = await captureRankSnapshot(user.id, effectiveSummonerId);
        } else {
          rankWarning = "Rank tracking unavailable — re-link your Riot account in Settings.";
        }

        const parts = [`Synced ${syncedCount} match${syncedCount !== 1 ? "es" : ""}`];
        if (failedCount > 0) {
          parts.push(`(${failedCount} failed)`);
        }
        if (rankWarning) {
          parts.push(rankWarning);
        }

        send({
          type: "done",
          synced: syncedCount,
          failed: failedCount,
          message: parts.join(" ") + ".",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to sync matches";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function captureRankSnapshot(userId: string, summonerId: string): Promise<string | null> {
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
      return null;
    }
    return "No Solo/Duo rank found — rank tracking only works for ranked Solo/Duo games.";
  } catch (error) {
    console.error("Failed to capture rank snapshot:", error);
    if (error instanceof RiotApiError && error.status === 400) {
      return "Rank tracking failed — please re-link your Riot account in Settings.";
    }
    return "Rank snapshot failed — try again later.";
  }
}

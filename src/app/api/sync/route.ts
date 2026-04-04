import { eq, desc } from "drizzle-orm";

import { db } from "@/db";
import { matches, rankSnapshots, users } from "@/db/schema";
import { checkGoalAchievement } from "@/lib/goals";
import { checkRateLimit } from "@/lib/rate-limit";
import { calculateAdaptiveDelay } from "@/lib/rate-limiter";
import {
  getMatchIds,
  getMatch,
  extractPlayerData,
  findMatchupChampion,
  findDuoPartner,
  extractDuoPartnerData,
  getKeystoneName,
  getSoloQueueEntryByPuuid,
  getLastRateLimitInfo,
  RiotApiError,
} from "@/lib/riot-api";
import { getCurrentUser } from "@/lib/session";
import {
  acquireSyncLock,
  releaseSyncLock,
  getActiveSyncCount,
  extendSyncLock,
} from "@/lib/sync-lock";

function sseMessage(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

const MAX_BATCH_LIMIT = 50;

/** Max time to wait for a sync slot before giving up (30 seconds). */
const MAX_QUEUE_WAIT_MS = 30_000;

/** Interval between polling for a free sync slot (3 seconds). */
const QUEUE_POLL_INTERVAL_MS = 3_000;

/** Extend lock every 20 matches to prevent expiry during long syncs. */
const HEARTBEAT_INTERVAL = 20;

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.puuid) {
    return Response.json(
      { error: "Please link your Riot account first in Settings." },
      { status: 400 },
    );
  }

  // Optional ?limit=N — sync at most N matches per request (for batched sync)
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const batchLimit = limitParam
    ? Math.min(Math.max(parseInt(limitParam, 10) || MAX_BATCH_LIMIT, 1), MAX_BATCH_LIMIT)
    : null;

  const region = user.region || "euw1";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(sseMessage(data)));
        } catch {
          // Stream may already be closed (client disconnected) — ignore
        }
      };

      // ── Rate limit check ───────────────────────────────────────────
      const rateCheck = await checkRateLimit(user.id, "sync");
      if (!rateCheck.allowed) {
        send({
          type: "error",
          message: `You can only sync once every 5 minutes. Try again in ${rateCheck.retryAfter} seconds.`,
        });
        controller.close();
        return;
      }

      // ── Acquire sync lock ────────────────────────────────────────────
      let lockAcquired = false;

      try {
        const lockResult = await acquireSyncLock(user.id);

        if (lockResult.status === "already_locked") {
          send({
            type: "locked",
            message: "A sync is already in progress. Please wait for it to finish.",
          });
          controller.close();
          return;
        }

        if (lockResult.status === "too_many_syncs") {
          // Wait for a slot to open up, polling periodically
          send({
            type: "waiting",
            message: "Other players are syncing. Waiting for your turn...",
          });

          const waitStart = Date.now();
          let acquired = false;

          while (Date.now() - waitStart < MAX_QUEUE_WAIT_MS) {
            await new Promise((resolve) => setTimeout(resolve, QUEUE_POLL_INTERVAL_MS));

            const retryResult = await acquireSyncLock(user.id);
            if (retryResult.status === "acquired") {
              acquired = true;
              break;
            }
            if (retryResult.status === "already_locked") {
              // This user already started a sync from another tab while waiting
              send({
                type: "locked",
                message: "A sync is already in progress. Please wait for it to finish.",
              });
              controller.close();
              return;
            }
            // Still too_many_syncs — keep waiting
            send({
              type: "waiting",
              message: "Other players are syncing. Waiting for your turn...",
            });
          }

          if (!acquired) {
            send({
              type: "error",
              message: "Timed out waiting for a sync slot. Please try again in a minute.",
            });
            controller.close();
            return;
          }
        }

        lockAcquired = true;

        // ── Sync logic (same as before, with adaptive delays) ────────────
        send({ type: "status", message: "Checking existing matches..." });

        // Check which matches we already have
        const existingMatches = await db.query.matches.findMany({
          where: eq(matches.userId, user.id),
          columns: { id: true },
        });
        const existingIds = new Set(existingMatches.map((m: { id: string }) => m.id));

        send({ type: "status", message: "Fetching match history from Riot..." });

        // Season 2026 start: January 8, 2026 (epoch seconds)
        const SEASON_START = Math.floor(new Date("2026-01-05T00:00:00Z").getTime() / 1000);

        // Fetch all ranked match IDs via pagination
        const allMatchIds: string[] = [];
        let start = 0;
        const PAGE_SIZE = 100;

        while (true) {
          const batch = await getMatchIds(
            user.puuid!,
            {
              queue: 420,
              count: PAGE_SIZE,
              start,
              startTime: SEASON_START,
            },
            region,
          );

          if (batch.length === 0) break;

          allMatchIds.push(...batch);
          start += batch.length;

          send({
            type: "status",
            message: `Found ${allMatchIds.length} matches in history...`,
          });

          if (batch.length < PAGE_SIZE) break;

          // Adaptive delay for match list pagination
          const activeSyncs = await getActiveSyncCount();
          const rateLimitInfo = getLastRateLimitInfo();
          const delay = calculateAdaptiveDelay(rateLimitInfo, activeSyncs);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // Filter to only new matches
        const allNewMatchIds = allMatchIds.filter((id) => !existingIds.has(id));

        if (allNewMatchIds.length === 0) {
          // Still capture rank snapshot
          const rankWarning = await captureRankSnapshot(user.id, user.puuid!, region);
          // Check if rank goal was achieved
          await checkGoalAchievement(user.id);
          const msg = rankWarning
            ? `No new matches found. ${rankWarning}`
            : "No new matches found. Rank snapshot captured.";
          send({ type: "done", synced: 0, remaining: 0, message: msg });
          controller.close();
          return;
        }

        // When a batch limit is set, only sync the first N matches.
        // Riot returns newest-first, so this syncs the most recent games.
        const newMatchIds = batchLimit ? allNewMatchIds.slice(0, batchLimit) : allNewMatchIds;
        const remaining = allNewMatchIds.length - newMatchIds.length;

        // Capture rank snapshot BEFORE syncing — gives a "before" data point
        // so the LP chart shows the delta across this sync session
        await captureRankSnapshot(user.id, user.puuid!, region);

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
            const matchData = await getMatch(matchId, region);
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

            await db
              .insert(matches)
              .values({
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
                position: playerData.position,
                rawMatchJson: JSON.stringify(matchData),
                duoPartnerPuuid: detectedDuoPuuid,
                duoPartnerChampionName: duoPartnerData?.championName ?? null,
                duoPartnerKills: duoPartnerData?.kills ?? null,
                duoPartnerDeaths: duoPartnerData?.deaths ?? null,
                duoPartnerAssists: duoPartnerData?.assists ?? null,
              })
              .onConflictDoUpdate({
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
                  position: playerData.position,
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

          // Adaptive delay between API calls based on rate limit headers
          // and number of concurrent syncs. This replaces the old fixed 100ms delay.
          const activeSyncs = await getActiveSyncCount();
          const rateLimitInfo = getLastRateLimitInfo();
          const delay = calculateAdaptiveDelay(rateLimitInfo, activeSyncs);
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Heartbeat: extend lock expiry every N matches to prevent timeout
          if ((i + 1) % HEARTBEAT_INTERVAL === 0) {
            await extendSyncLock(user.id);
          }
        }

        // Capture rank snapshot
        const rankWarning = await captureRankSnapshot(user.id, user.puuid!, region);

        // Check if rank goal was achieved after syncing
        await checkGoalAchievement(user.id);

        // Cache invalidation is handled client-side via a Server Action
        // after the "done" event (updateTag cannot be called from Route Handlers).

        const parts = [`Synced ${syncedCount} match${syncedCount !== 1 ? "es" : ""}`];
        if (failedCount > 0) {
          parts.push(`(${failedCount} failed)`);
        }
        if (remaining > 0) {
          parts.push(`(${remaining} remaining)`);
        }
        if (rankWarning) {
          parts.push(rankWarning);
        }

        send({
          type: "done",
          synced: syncedCount,
          failed: failedCount,
          remaining,
          message: parts.join(" ") + ".",
        });
      } catch (error) {
        console.error("Sync error:", error);
        const message =
          error instanceof RiotApiError
            ? error.userMessage
            : "Failed to sync matches. Please try again.";
        send({ type: "error", message });
      } finally {
        // Always release the lock when done (success, error, or crash)
        if (lockAcquired) {
          try {
            await releaseSyncLock(user.id);
          } catch (e) {
            console.error("Failed to release sync lock:", e);
          }
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
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

async function captureRankSnapshot(
  userId: string,
  puuid: string,
  region: string,
): Promise<string | null> {
  try {
    const entry = await getSoloQueueEntryByPuuid(puuid, region);
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

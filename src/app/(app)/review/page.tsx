import { eq, ne, and, asc, desc, inArray, count, or, isNull } from "drizzle-orm";

import type { Match } from "@/db/schema";

import { db } from "@/db";
import { matches, matchHighlights } from "@/db/schema";
import { getLatestVersion } from "@/lib/riot-api";
import { requireUser } from "@/lib/session";

import { ReviewClient } from "./review-client";

const COMPLETED_PAGE_SIZE = 10;
const VALID_TABS = ["post-game", "vod", "completed"] as const;

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const completedPage = Math.max(1, parseInt(String(params.completedPage ?? "1"), 10) || 1);
  const tabParam = String(params.tab ?? "post-game");
  const initialTab = VALID_TABS.includes(tabParam as (typeof VALID_TABS)[number])
    ? (tabParam as (typeof VALID_TABS)[number])
    : "post-game";
  const completedOffset = (completedPage - 1) * COMPLETED_PAGE_SIZE;

  const reviewedWhere = and(
    eq(matches.userId, user.id),
    eq(matches.reviewed, true),
    ne(matches.result, "Remake"),
  );

  const matchColumns = {
    id: true,
    odometer: true,
    userId: true,
    gameDate: true,
    result: true,
    championId: true,
    championName: true,
    runeKeystoneId: true,
    runeKeystoneName: true,
    matchupChampionId: true,
    matchupChampionName: true,
    kills: true,
    deaths: true,
    assists: true,
    cs: true,
    csPerMin: true,
    gameDurationSeconds: true,
    goldEarned: true,
    visionScore: true,
    comment: true,
    reviewed: true,
    reviewNotes: true,
    reviewSkippedReason: true,
    vodUrl: true,
    queueId: true,
    syncedAt: true,
    duoPartnerPuuid: true,
    position: true,
    // rawMatchJson excluded — not needed for review list
  } as const;

  // Only show main-role games in the review queue (off-role excluded).
  // Games with unknown position (NULL) are included to avoid hiding data.
  const unreviewedPositionFilter = user.primaryRole
    ? or(eq(matches.position, user.primaryRole), isNull(matches.position))
    : undefined;

  // Fetch DDragon version + unreviewed matches + paginated reviewed matches + reviewed count
  const [ddragonVersion, unreviewedMatches, reviewedMatches, reviewedCountResult] =
    await Promise.all([
      getLatestVersion(),
      db.query.matches.findMany({
        where: and(
          eq(matches.userId, user.id),
          eq(matches.reviewed, false),
          ne(matches.result, "Remake"),
          unreviewedPositionFilter,
        ),
        orderBy: asc(matches.gameDate),
        limit: 50,
        columns: matchColumns,
      }) as unknown as Promise<Match[]>,
      db.query.matches.findMany({
        where: reviewedWhere,
        orderBy: desc(matches.gameDate),
        limit: COMPLETED_PAGE_SIZE,
        offset: completedOffset,
        columns: matchColumns,
      }) as unknown as Promise<Match[]>,
      db.select({ total: count() }).from(matches).where(reviewedWhere),
    ]);

  const completedTotal = reviewedCountResult[0]?.total ?? 0;
  const completedTotalPages = Math.max(1, Math.ceil(completedTotal / COMPLETED_PAGE_SIZE));

  // Fetch highlights for all matches (unreviewed + current page of reviewed)
  const allMatchIds = [...unreviewedMatches.map((m) => m.id), ...reviewedMatches.map((m) => m.id)];
  const allHighlights =
    allMatchIds.length > 0
      ? await db
          .select()
          .from(matchHighlights)
          .where(
            and(eq(matchHighlights.userId, user.id), inArray(matchHighlights.matchId, allMatchIds)),
          )
      : [];

  // Group highlights by matchId
  const highlightsByMatch: Record<
    string,
    Array<{
      id: number;
      type: "highlight" | "lowlight";
      text: string;
      topic: string | null;
    }>
  > = {};
  for (const h of allHighlights) {
    if (!highlightsByMatch[h.matchId]) {
      highlightsByMatch[h.matchId] = [];
    }
    highlightsByMatch[h.matchId].push({
      id: h.id,
      type: h.type,
      text: h.text,
      topic: h.topic,
    });
  }

  return (
    <ReviewClient
      unreviewedMatches={unreviewedMatches}
      reviewedMatches={reviewedMatches}
      highlightsByMatch={highlightsByMatch}
      ddragonVersion={ddragonVersion}
      completedPage={Math.min(completedPage, completedTotalPages)}
      completedTotalPages={completedTotalPages}
      completedTotal={completedTotal}
      initialTab={initialTab}
    />
  );
}

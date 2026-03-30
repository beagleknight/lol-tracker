import { eq, and, desc, sql, inArray, count } from "drizzle-orm";

import { db } from "@/db";
import { matches, matchHighlights, type Match } from "@/db/schema";
import { winLossRemakeSelect } from "@/lib/match-queries";
import { getLatestVersion } from "@/lib/riot-api";
import { requireUser } from "@/lib/session";

import { MatchesClient } from "./matches-client";

const PAGE_SIZE = 10;

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  // Parse search params
  const page = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);
  const search = typeof params.search === "string" ? params.search : "";
  const result = typeof params.result === "string" ? params.result : "all";
  const champion = typeof params.champion === "string" ? params.champion : "all";
  const review = typeof params.review === "string" ? params.review : "all";

  // Build WHERE conditions
  const conditions = [eq(matches.userId, user.id)];
  if (result === "Victory" || result === "Defeat" || result === "Remake") {
    conditions.push(eq(matches.result, result));
  }
  if (champion !== "all") {
    conditions.push(eq(matches.championName, champion));
  }
  if (review === "reviewed") {
    conditions.push(eq(matches.reviewed, true));
  } else if (review === "unreviewed") {
    conditions.push(eq(matches.reviewed, false));
  } else if (review === "has-notes") {
    conditions.push(sql`${matches.comment} IS NOT NULL AND ${matches.comment} != ''`);
  }
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      sql`(
        ${matches.championName} LIKE ${pattern}
        OR ${matches.matchupChampionName} LIKE ${pattern}
        OR ${matches.runeKeystoneName} LIKE ${pattern}
        OR ${matches.comment} LIKE ${pattern}
        OR ${matches.reviewNotes} LIKE ${pattern}
      )`,
    );
  }

  const whereClause = and(...conditions);

  // Run: paginated matches + total count + champion list + highlights — in parallel
  const offset = (page - 1) * PAGE_SIZE;

  const [pageMatches, countResult, championRows, ddragonVersion, statsResult] = await Promise.all([
    db.query.matches.findMany({
      where: whereClause,
      orderBy: desc(matches.gameDate),
      limit: PAGE_SIZE,
      offset,
      columns: {
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
      },
    }),
    db.select({ total: count() }).from(matches).where(whereClause),
    // Lightweight query: distinct champion names for filter dropdown
    db
      .selectDistinct({ championName: matches.championName })
      .from(matches)
      .where(eq(matches.userId, user.id)),
    getLatestVersion(),
    // Win/loss stats for the filtered set
    db.select(winLossRemakeSelect).from(matches).where(whereClause),
  ]);

  const totalMatches = countResult[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));
  const champions = championRows.map((r) => r.championName).sort();
  const wins = statsResult[0]?.wins ?? 0;
  const losses = statsResult[0]?.losses ?? 0;

  // Fetch highlights ONLY for the current page's matches
  const matchIds = pageMatches.map((m) => m.id);
  const pageHighlights =
    matchIds.length > 0
      ? await db.query.matchHighlights.findMany({
          where: and(
            eq(matchHighlights.userId, user.id),
            inArray(matchHighlights.matchId, matchIds),
          ),
          columns: {
            matchId: true,
            type: true,
            text: true,
            topic: true,
          },
        })
      : [];

  // Build highlight data per match
  const highlightsPerMatch: Record<
    string,
    Array<{ type: "highlight" | "lowlight"; text: string; topic: string | null }>
  > = {};
  for (const h of pageHighlights) {
    if (!highlightsPerMatch[h.matchId]) {
      highlightsPerMatch[h.matchId] = [];
    }
    highlightsPerMatch[h.matchId].push({
      type: h.type as "highlight" | "lowlight",
      text: h.text,
      topic: h.topic,
    });
  }

  return (
    <MatchesClient
      matches={pageMatches as Match[]}
      ddragonVersion={ddragonVersion}
      isRiotLinked={!!user.puuid}
      highlightsPerMatch={highlightsPerMatch}
      // Server pagination state
      currentPage={Math.min(page, totalPages)}
      totalPages={totalPages}
      totalMatches={totalMatches}
      wins={wins}
      losses={losses}
      champions={champions}
      // Current filter values (for controlled inputs)
      filters={{ search, result, champion, review }}
    />
  );
}

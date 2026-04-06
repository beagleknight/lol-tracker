import { eq, and, desc, sql } from "drizzle-orm";

import { db } from "@/db";
import { matches } from "@/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";

// ─── CSV Helpers ─────────────────────────────────────────────────────────────

// Safety limit — prevents unbounded queries on the free-tier DB.
// 10 000 rows ≈ ~3 years of daily play. Adjust if needed.
const EXPORT_LIMIT = 10_000;

/** Escape a value for CSV: wrap in quotes if it contains commas, quotes, or newlines. */
function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

const CSV_HEADERS = [
  "Match ID",
  "Date",
  "Result",
  "Champion",
  "Matchup",
  "Keystone",
  "Kills",
  "Deaths",
  "Assists",
  "CS",
  "CS/min",
  "Duration",
  "Gold",
  "Vision Score",
  "Queue ID",
  "Reviewed",
  "Comment",
  "Review Notes",
  "VOD URL",
  "Duo Partner Champion",
] as const;

function matchToCsvRow(match: {
  id: string;
  gameDate: Date;
  result: string;
  championName: string;
  matchupChampionName: string | null;
  runeKeystoneName: string | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  csPerMin: number | null;
  gameDurationSeconds: number;
  goldEarned: number | null;
  visionScore: number | null;
  queueId: number | null;
  reviewed: boolean;
  comment: string | null;
  reviewNotes: string | null;
  vodUrl: string | null;
  duoPartnerChampionName: string | null;
}): string {
  return [
    csvEscape(match.id),
    csvEscape(formatDate(match.gameDate)),
    csvEscape(match.result),
    csvEscape(match.championName),
    csvEscape(match.matchupChampionName),
    csvEscape(match.runeKeystoneName),
    csvEscape(match.kills),
    csvEscape(match.deaths),
    csvEscape(match.assists),
    csvEscape(match.cs),
    csvEscape(match.csPerMin != null ? match.csPerMin.toFixed(1) : null),
    csvEscape(formatDuration(match.gameDurationSeconds)),
    csvEscape(match.goldEarned),
    csvEscape(match.visionScore),
    csvEscape(match.queueId),
    csvEscape(match.reviewed ? "Yes" : "No"),
    csvEscape(match.comment),
    csvEscape(match.reviewNotes),
    csvEscape(match.vodUrl),
    csvEscape(match.duoPartnerChampionName),
  ].join(",");
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit check
  const rateCheck = await checkRateLimit(user.id, "export");
  if (!rateCheck.allowed) {
    return Response.json(
      { error: `Rate limit exceeded. Try again in ${rateCheck.retryAfter} seconds.` },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfter) } },
    );
  }

  // Parse filter params (same as matches page)
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const result = url.searchParams.get("result") ?? "all";
  const champion = url.searchParams.get("champion") ?? "all";
  const review = url.searchParams.get("review") ?? "all";

  // Build WHERE conditions
  const conditions = [
    eq(matches.userId, user.id),
    eq(matches.riotAccountId, user.activeRiotAccountId!),
  ];
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

  const allMatches = await db.query.matches.findMany({
    where: and(...conditions),
    orderBy: desc(matches.gameDate),
    limit: EXPORT_LIMIT,
    columns: {
      id: true,
      gameDate: true,
      result: true,
      championName: true,
      matchupChampionName: true,
      runeKeystoneName: true,
      kills: true,
      deaths: true,
      assists: true,
      cs: true,
      csPerMin: true,
      gameDurationSeconds: true,
      goldEarned: true,
      visionScore: true,
      queueId: true,
      reviewed: true,
      comment: true,
      reviewNotes: true,
      vodUrl: true,
      duoPartnerChampionName: true,
    },
  });

  const csvLines = [CSV_HEADERS.join(","), ...allMatches.map(matchToCsvRow)];
  const csvContent = csvLines.join("\n");

  const today = new Date().toISOString().slice(0, 10);
  const filename = `matches-export-${today}.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

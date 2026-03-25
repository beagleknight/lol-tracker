"use server";

import { db } from "@/db";
import { matches } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { invalidateAllCaches } from "@/lib/cache";

interface CsvRow {
  date: string;
  result: string;
  champion: string;
  rune: string;
  matchup: string;
  comments: string;
  reviewed: string;
  reviewNotes: string;
}

/**
 * Normalize champion names so CSV names match Riot API names.
 * Riot API strips spaces and apostrophes (e.g. "KogMaw", "TwistedFate", "Velkoz").
 * CSV may have "Kog'Maw", "Twisted Fate", "Vel'Koz", or typos like "Ashkan" for "Akshan".
 */
function normalizeChampionName(name: string): string {
  let n = name.trim().toLowerCase().replace(/['\s]/g, "");

  // Known typo corrections
  const corrections: Record<string, string> = {
    ashkan: "akshan",
  };
  if (corrections[n]) {
    n = corrections[n];
  }

  return n;
}

/**
 * Parse a date string in DD/MM/YYYY or D/MM/YYYY or YYYY-MM-DD format
 * and return the calendar date components (in the local timezone).
 */
function parseDateString(dateStr: string): { year: number; month: number; day: number } | null {
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return { year, month, day };
  } else {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }
}

/**
 * Format date components to a consistent key "YYYY-MM-DD"
 */
function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Merge CSV comments/review notes onto existing synced matches.
 *
 * Matching strategy:
 * 1. Group DB matches by calendar date (sorted by gameDate ascending = chronological)
 * 2. Group CSV rows by calendar date (the CSV is reverse chronological, so we reverse
 *    each day's rows to get chronological order)
 * 3. For each date, match CSV rows to DB matches by: champion + matchup + result
 * 4. When multiple games share the same date+champion+matchup+result combo, match
 *    them by ordinal position (1st to 1st, 2nd to 2nd, etc.)
 * 5. Only update if the CSV row has a non-empty comment or review notes
 */
export async function importCsvData(rows: CsvRow[]) {
  const user = await requireUser();

  // 1. Fetch all matches from the database for this user (exclude rawMatchJson — not needed for CSV matching)
  const allMatches = await db
    .select({
      id: matches.id,
      userId: matches.userId,
      gameDate: matches.gameDate,
      result: matches.result,
      championName: matches.championName,
      matchupChampionName: matches.matchupChampionName,
    })
    .from(matches)
    .where(eq(matches.userId, user.id))
    .orderBy(matches.gameDate);

  // 2. Group DB matches by date key
  const dbByDate = new Map<string, typeof allMatches>();
  for (const m of allMatches) {
    const d = new Date(m.gameDate.getTime());
    const key = dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
    if (!dbByDate.has(key)) dbByDate.set(key, []);
    dbByDate.get(key)!.push(m);
  }

  // 3. Filter valid CSV rows and group by date key
  //    CSV rows come in reverse chronological order from the spreadsheet,
  //    so rows within the same date are also newest-first. We'll reverse per-date.
  const csvByDate = new Map<string, CsvRow[]>();
  const skippedRows: string[] = [];

  for (const row of rows) {
    // Skip rows without essential fields
    if (!row.date || !row.result || !row.champion) {
      skippedRows.push(`Empty row skipped`);
      continue;
    }

    const parsed = parseDateString(row.date);
    if (!parsed) {
      skippedRows.push(`Invalid date: "${row.date}"`);
      continue;
    }

    const key = dateKey(parsed.year, parsed.month, parsed.day);
    if (!csvByDate.has(key)) csvByDate.set(key, []);
    csvByDate.get(key)!.push(row);
  }

  // 4. Reverse each date's CSV rows to get chronological order
  for (const [, dateRows] of csvByDate) {
    dateRows.reverse();
  }

  // 5. Match and merge
  let merged = 0;
  let unmatched = 0;
  const unmatchedDetails: string[] = [];

  for (const [key, csvRows] of csvByDate) {
    const dbMatches = dbByDate.get(key);
    if (!dbMatches) {
      // No DB matches for this date at all
      unmatched += csvRows.length;
      for (const r of csvRows) {
        unmatchedDetails.push(`${r.date} ${r.champion} vs ${r.matchup} (${r.result}) - no matches on this date`);
      }
      continue;
    }

    // Build a lookup: for each (normalChampion, normalMatchup, result) combo,
    // keep an ordered list of DB matches
    type MatchKey = string;
    const makeKey = (champ: string, matchup: string, result: string): MatchKey =>
      `${normalizeChampionName(champ)}|${normalizeChampionName(matchup)}|${result.toLowerCase()}`;

    const dbLookup = new Map<MatchKey, typeof allMatches>();
    for (const m of dbMatches) {
      const k = makeKey(m.championName, m.matchupChampionName || "", m.result);
      if (!dbLookup.has(k)) dbLookup.set(k, []);
      dbLookup.get(k)!.push(m);
    }

    // Track consumption index per key (for handling duplicates)
    const consumedIndex = new Map<MatchKey, number>();

    for (const csvRow of csvRows) {
      const csvResult = csvRow.result.toLowerCase().includes("victory") || csvRow.result.toLowerCase() === "w"
        ? "Victory"
        : "Defeat";
      const k = makeKey(csvRow.champion, csvRow.matchup, csvResult);
      const candidates = dbLookup.get(k);

      if (!candidates || candidates.length === 0) {
        unmatched++;
        unmatchedDetails.push(`${csvRow.date} ${csvRow.champion} vs ${csvRow.matchup} (${csvResult}) - no matching game found`);
        continue;
      }

      const idx = consumedIndex.get(k) || 0;
      if (idx >= candidates.length) {
        unmatched++;
        unmatchedDetails.push(`${csvRow.date} ${csvRow.champion} vs ${csvRow.matchup} (${csvResult}) - all matching games already consumed`);
        continue;
      }

      const dbMatch = candidates[idx];
      consumedIndex.set(k, idx + 1);

      // Only update if there's something to merge
      const hasComment = csvRow.comments.trim().length > 0;
      const hasReviewNotes = csvRow.reviewNotes.trim().length > 0;
      const hasReviewed =
        csvRow.reviewed.toLowerCase() === "yes" ||
        csvRow.reviewed.toLowerCase() === "true" ||
        csvRow.reviewed === "1";

      if (!hasComment && !hasReviewNotes && !hasReviewed) {
        // Nothing to merge from this CSV row
        continue;
      }

      // Build update payload — only set fields that have values
      const updatePayload: Record<string, unknown> = {};
      if (hasComment) {
        updatePayload.comment = csvRow.comments.trim();
      }
      if (hasReviewNotes) {
        updatePayload.reviewNotes = csvRow.reviewNotes.trim();
      }
      if (hasReviewed) {
        updatePayload.reviewed = true;
      }

      await db
        .update(matches)
        .set(updatePayload)
        .where(and(eq(matches.id, dbMatch.id), eq(matches.userId, user.id)));

      merged++;
    }
  }

  revalidatePath("/matches");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  invalidateAllCaches(user.id);

  const parts: string[] = [];
  parts.push(`Merged comments into ${merged} match${merged !== 1 ? "es" : ""}`);
  if (unmatched > 0) {
    parts.push(`${unmatched} row${unmatched !== 1 ? "s" : ""} had no matching game`);
  }

  return {
    merged,
    unmatched,
    unmatchedDetails: unmatchedDetails.slice(0, 20), // Limit to first 20 for display
    message: parts.join(". ") + ".",
  };
}

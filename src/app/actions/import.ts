"use server";

import { db } from "@/db";
import { matches } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { revalidatePath } from "next/cache";

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

export async function importCsvData(rows: CsvRow[]) {
  const user = await requireUser();

  // Get current max odometer
  const maxOdoResult = await db.query.matches.findFirst({
    orderBy: desc(matches.odometer),
    columns: { odometer: true },
  });
  let nextOdometer = (maxOdoResult?.odometer || 0) + 1;

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      // Parse date — expect DD/MM/YYYY or YYYY-MM-DD
      let gameDate: Date;
      if (row.date.includes("/")) {
        const [day, month, year] = row.date.split("/");
        gameDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        gameDate = new Date(row.date);
      }

      if (isNaN(gameDate.getTime())) {
        skipped++;
        continue;
      }

      const result = row.result.toLowerCase().includes("victory") || row.result.toLowerCase() === "w"
        ? "Victory"
        : "Defeat";

      const reviewed =
        row.reviewed.toLowerCase() === "yes" ||
        row.reviewed.toLowerCase() === "true" ||
        row.reviewed === "1";

      // Generate a synthetic ID for imported rows
      const syntheticId = `IMPORT_${gameDate.getTime()}_${row.champion}_${nextOdometer}`;

      await db.insert(matches).values({
        id: syntheticId,
        odometer: nextOdometer++,
        userId: user.id,
        gameDate,
        result: result as "Victory" | "Defeat",
        championId: 0, // Unknown from CSV
        championName: row.champion.trim(),
        runeKeystoneName: row.rune.trim() || null,
        runeKeystoneId: null,
        matchupChampionId: null,
        matchupChampionName: row.matchup.trim() || null,
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        csPerMin: 0,
        gameDurationSeconds: 0,
        goldEarned: 0,
        visionScore: 0,
        comment: row.comments.trim() || null,
        reviewed,
        reviewNotes: row.reviewNotes.trim() || null,
        queueId: 420,
      });

      imported++;
    } catch (error) {
      console.error("Failed to import row:", row, error);
      skipped++;
    }
  }

  revalidatePath("/matches");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");

  return {
    imported,
    skipped,
    message: `Imported ${imported} game${imported !== 1 ? "s" : ""}${skipped > 0 ? `, skipped ${skipped}` : ""}.`,
  };
}

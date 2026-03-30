"use server";

import { eq, and, isNull } from "drizzle-orm";
import { revalidateTag } from "next/cache";

import { db } from "@/db";
import { matchupNotes } from "@/db/schema";
import { scoutTag } from "@/lib/cache";
import { requireUser } from "@/lib/session";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MatchupNoteData {
  id: number;
  championName: string | null;
  matchupChampionName: string;
  content: string;
  updatedAt: Date;
  createdAt: Date;
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Get matchup notes for a given enemy champion.
 * Returns both general notes (championName = null) and champion-specific notes.
 */
export async function getMatchupNotes(
  matchupChampionName: string,
  championName?: string,
): Promise<MatchupNoteData[]> {
  const user = await requireUser();

  const conditions = [
    eq(matchupNotes.userId, user.id),
    eq(matchupNotes.matchupChampionName, matchupChampionName),
  ];

  const rows = await db
    .select()
    .from(matchupNotes)
    .where(and(...conditions))
    .orderBy(matchupNotes.championName); // null (general) sorts first

  // If a specific champion is selected, return both general + that champion's note
  // If no champion, return only general notes
  const filtered = championName
    ? rows.filter((r) => r.championName === null || r.championName === championName)
    : rows.filter((r) => r.championName === null);

  return filtered.map((r) => ({
    id: r.id,
    championName: r.championName,
    matchupChampionName: r.matchupChampionName,
    content: r.content,
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
  }));
}

/**
 * Get matchup notes for a match detail page.
 * Returns notes relevant to the given champion vs enemy matchup.
 */
export async function getMatchupNotesForMatch(
  championName: string,
  matchupChampionName: string,
): Promise<MatchupNoteData[]> {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(matchupNotes)
    .where(
      and(
        eq(matchupNotes.userId, user.id),
        eq(matchupNotes.matchupChampionName, matchupChampionName),
      ),
    )
    .orderBy(matchupNotes.championName);

  // Return both general notes and notes specific to this champion
  const filtered = rows.filter((r) => r.championName === null || r.championName === championName);

  return filtered.map((r) => ({
    id: r.id,
    championName: r.championName,
    matchupChampionName: r.matchupChampionName,
    content: r.content,
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
  }));
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Upsert a matchup note. If content is empty/blank, deletes the note instead.
 * Uses ON CONFLICT (userId, championName, matchupChampionName) DO UPDATE.
 */
export async function upsertMatchupNote(
  championName: string | null,
  matchupChampionName: string,
  content: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();
  const trimmed = content.trim();

  if (!matchupChampionName.trim()) {
    return { success: false, error: "Enemy champion is required." };
  }

  // If content is empty, delete the note
  if (!trimmed) {
    // Find and delete the matching note
    const conditions = [
      eq(matchupNotes.userId, user.id),
      eq(matchupNotes.matchupChampionName, matchupChampionName),
    ];
    if (championName) {
      conditions.push(eq(matchupNotes.championName, championName));
    } else {
      conditions.push(isNull(matchupNotes.championName));
    }

    await db.delete(matchupNotes).where(and(...conditions));
    revalidateTag(scoutTag(user.id), "max");
    return { success: true };
  }

  // Upsert: insert or update on conflict
  const now = new Date();
  await db
    .insert(matchupNotes)
    .values({
      userId: user.id,
      championName: championName || null,
      matchupChampionName,
      content: trimmed,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [matchupNotes.userId, matchupNotes.championName, matchupNotes.matchupChampionName],
      set: {
        content: trimmed,
        updatedAt: now,
      },
    });

  revalidateTag(scoutTag(user.id), "max");
  return { success: true };
}

/**
 * Delete a matchup note by ID (ownership-checked).
 */
export async function deleteMatchupNote(id: number): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();

  await db
    .delete(matchupNotes)
    .where(and(eq(matchupNotes.id, id), eq(matchupNotes.userId, user.id)));

  revalidateTag(scoutTag(user.id), "max");
  return { success: true };
}

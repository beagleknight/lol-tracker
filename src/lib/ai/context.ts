/**
 * Data gathering helpers for AI insight prompts.
 *
 * Each builder queries the DB for relevant context and returns
 * a structured object consumed by the prompt templates.
 */

import { eq, and, desc, sql, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  matches,
  matchHighlights,
  matchupNotes,
  coachingActionItems,
  goals,
  rankSnapshots,
} from "@/db/schema";
import { notRemake } from "@/lib/match-queries";

// ─── Shared types ───────────────────────────────────────────────────────────

interface ActionItemSummary {
  description: string;
  topic: string | null;
  status: string;
}

interface GoalSummary {
  title: string;
  status: string;
}

interface GameSummary {
  result: string;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  csPerMin: number;
  gameDurationMin: number;
  comment: string | null;
  highlights: string[];
}

interface AvgStats {
  kills: number;
  deaths: number;
  assists: number;
  csPerMin: number;
  goldEarned: number;
  visionScore: number;
  games: number;
}

// ─── Matchup Insight Context ────────────────────────────────────────────────

export interface MatchupInsightContext {
  summonerName: string;
  currentRank: string | null;
  yourChampionName: string | undefined;
  enemyChampionName: string;
  record: { wins: number; losses: number; total: number; winRate: number };
  avgStats: {
    kills: number;
    deaths: number;
    assists: number;
    csPerMin: number;
    goldEarned: number;
    visionScore: number;
  };
  overallAvgStats: AvgStats;
  runeBreakdown: Array<{
    keystoneName: string;
    games: number;
    wins: number;
    losses: number;
    winRate: number;
  }>;
  recentGames: GameSummary[];
  matchupNotes: string | null;
  activeActionItems: ActionItemSummary[];
  activeGoals: GoalSummary[];
}

/**
 * Build context for a matchup insight.
 * Re-uses the matchup report data that's already loaded on the Scout page,
 * plus fetches coaching context from the DB.
 */
export async function buildMatchupContext(
  userId: string,
  riotAccountId: string | null,
  summonerName: string,
  enemyChampionName: string,
  yourChampionName: string | undefined,
  report: {
    record: { wins: number; losses: number; total: number; winRate: number };
    avgStats: {
      kills: number;
      deaths: number;
      assists: number;
      csPerMin: number;
      goldEarned: number;
      visionScore: number;
    };
    overallAvgStats: AvgStats;
    runeBreakdown: Array<{
      keystoneName: string;
      games: number;
      wins: number;
      losses: number;
      winRate: number;
    }>;
    games: Array<{
      result: string;
      championName: string;
      kills: number;
      deaths: number;
      assists: number;
      csPerMin: number;
      gameDurationSeconds: number;
      comment: string | null;
      highlights: Array<{ type: string; text: string; topic: string | null }>;
    }>;
  },
): Promise<MatchupInsightContext> {
  const accountFilterGoals = riotAccountId
    ? eq(goals.riotAccountId, riotAccountId)
    : isNull(goals.riotAccountId);
  const accountFilterRank = riotAccountId
    ? eq(rankSnapshots.riotAccountId, riotAccountId)
    : isNull(rankSnapshots.riotAccountId);

  // Fetch coaching context, notes, and rank in parallel
  const [actionItems, activeGoalRows, rankRow, noteRows] = await Promise.all([
    db
      .select({
        description: coachingActionItems.description,
        topic: coachingActionItems.topic,
        status: coachingActionItems.status,
      })
      .from(coachingActionItems)
      .where(
        and(
          eq(coachingActionItems.userId, userId),
          sql`${coachingActionItems.status} != 'completed'`,
        ),
      ),
    db
      .select({ title: goals.title, status: goals.status })
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.status, "active"), accountFilterGoals)),
    db
      .select({
        tier: rankSnapshots.tier,
        division: rankSnapshots.division,
        lp: rankSnapshots.lp,
      })
      .from(rankSnapshots)
      .where(and(eq(rankSnapshots.userId, userId), accountFilterRank))
      .orderBy(desc(rankSnapshots.capturedAt))
      .limit(1),
    db
      .select({ content: matchupNotes.content, championName: matchupNotes.championName })
      .from(matchupNotes)
      .where(
        and(
          eq(matchupNotes.userId, userId),
          eq(matchupNotes.matchupChampionName, enemyChampionName),
        ),
      ),
  ]);

  // Pick the most relevant note (champion-specific first, then general)
  let noteContent: string | null = null;
  if (yourChampionName) {
    const specific = noteRows.find((n) => n.championName === yourChampionName);
    if (specific) noteContent = specific.content;
  }
  if (!noteContent) {
    const general = noteRows.find((n) => n.championName === null);
    if (general) noteContent = general.content;
  }

  const currentRank = rankRow[0]
    ? `${rankRow[0].tier} ${rankRow[0].division} ${rankRow[0].lp} LP`
    : null;

  // Take the 5 most recent games for the prompt
  const recentGames: GameSummary[] = report.games.slice(0, 5).map((g) => ({
    result: g.result,
    championName: g.championName,
    kills: g.kills,
    deaths: g.deaths,
    assists: g.assists,
    csPerMin: g.csPerMin,
    gameDurationMin: Math.round(g.gameDurationSeconds / 60),
    comment: g.comment,
    highlights: g.highlights.map((h) => `[${h.type}]${h.topic ? ` (${h.topic})` : ""} ${h.text}`),
  }));

  return {
    summonerName,
    currentRank,
    yourChampionName,
    enemyChampionName,
    record: report.record,
    avgStats: report.avgStats,
    overallAvgStats: report.overallAvgStats,
    runeBreakdown: report.runeBreakdown,
    recentGames,
    matchupNotes: noteContent,
    activeActionItems: actionItems,
    activeGoals: activeGoalRows,
  };
}

// ─── Post-Game Insight Context ──────────────────────────────────────────────

export interface PostGameInsightContext {
  summonerName: string;
  currentRank: string | null;
  championName: string;
  matchupChampionName: string | null;
  result: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  csPerMin: number;
  goldEarned: number;
  visionScore: number;
  gameDurationMin: number;
  runeKeystoneName: string | null;
  comment: string | null;
  reviewNotes: string | null;
  highlights: Array<{ type: string; text: string; topic: string | null }>;
  championAvgStats: AvgStats | null;
  matchupNotes: string | null;
  activeActionItems: ActionItemSummary[];
  activeGoals: GoalSummary[];
}

export async function buildPostGameContext(
  userId: string,
  riotAccountId: string | null,
  summonerName: string,
  matchId: string,
): Promise<PostGameInsightContext | null> {
  const accountFilterMatches = riotAccountId
    ? eq(matches.riotAccountId, riotAccountId)
    : isNull(matches.riotAccountId);
  const accountFilterHighlights = riotAccountId
    ? eq(matchHighlights.riotAccountId, riotAccountId)
    : isNull(matchHighlights.riotAccountId);
  const accountFilterGoals = riotAccountId
    ? eq(goals.riotAccountId, riotAccountId)
    : isNull(goals.riotAccountId);
  const accountFilterRank = riotAccountId
    ? eq(rankSnapshots.riotAccountId, riotAccountId)
    : isNull(rankSnapshots.riotAccountId);

  // Fetch the match
  const match = await db.query.matches.findFirst({
    where: and(eq(matches.id, matchId), eq(matches.userId, userId), accountFilterMatches),
  });

  if (!match) return null;

  // Fetch all supporting context in parallel
  const [highlightRows, actionItems, activeGoalRows, rankRow, noteRows, championAvgRow] =
    await Promise.all([
      db
        .select({
          type: matchHighlights.type,
          text: matchHighlights.text,
          topic: matchHighlights.topic,
        })
        .from(matchHighlights)
        .where(
          and(
            eq(matchHighlights.matchId, matchId),
            eq(matchHighlights.userId, userId),
            accountFilterHighlights,
          ),
        ),
      db
        .select({
          description: coachingActionItems.description,
          topic: coachingActionItems.topic,
          status: coachingActionItems.status,
        })
        .from(coachingActionItems)
        .where(
          and(
            eq(coachingActionItems.userId, userId),
            sql`${coachingActionItems.status} != 'completed'`,
          ),
        ),
      db
        .select({ title: goals.title, status: goals.status })
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.status, "active"), accountFilterGoals)),
      db
        .select({
          tier: rankSnapshots.tier,
          division: rankSnapshots.division,
          lp: rankSnapshots.lp,
        })
        .from(rankSnapshots)
        .where(and(eq(rankSnapshots.userId, userId), accountFilterRank))
        .orderBy(desc(rankSnapshots.capturedAt))
        .limit(1),
      match.matchupChampionName
        ? db
            .select({ content: matchupNotes.content, championName: matchupNotes.championName })
            .from(matchupNotes)
            .where(
              and(
                eq(matchupNotes.userId, userId),
                eq(matchupNotes.matchupChampionName, match.matchupChampionName),
              ),
            )
        : Promise.resolve([]),
      // Champion averages
      db
        .select({
          avgKills: sql<number>`ROUND(AVG(${matches.kills}), 1)`,
          avgDeaths: sql<number>`ROUND(AVG(${matches.deaths}), 1)`,
          avgAssists: sql<number>`ROUND(AVG(${matches.assists}), 1)`,
          avgCsPerMin: sql<number>`ROUND(AVG(${matches.csPerMin}), 1)`,
          avgGold: sql<number>`ROUND(AVG(${matches.goldEarned}))`,
          avgVision: sql<number>`ROUND(AVG(${matches.visionScore}), 1)`,
          total: sql<number>`COUNT(*)`,
        })
        .from(matches)
        .where(
          and(
            eq(matches.userId, userId),
            eq(matches.championName, match.championName),
            accountFilterMatches,
            notRemake,
          ),
        ),
    ]);

  // Pick matchup note (champion-specific first)
  let noteContent: string | null = null;
  if (match.matchupChampionName) {
    const specific = noteRows.find((n) => n.championName === match.championName);
    if (specific) noteContent = specific.content;
    if (!noteContent) {
      const general = noteRows.find((n) => n.championName === null);
      if (general) noteContent = general.content;
    }
  }

  const currentRank = rankRow[0]
    ? `${rankRow[0].tier} ${rankRow[0].division} ${rankRow[0].lp} LP`
    : null;

  const avgRow = championAvgRow[0];
  const championAvgStats: AvgStats | null =
    avgRow && avgRow.total > 1
      ? {
          kills: avgRow.avgKills ?? 0,
          deaths: avgRow.avgDeaths ?? 0,
          assists: avgRow.avgAssists ?? 0,
          csPerMin: avgRow.avgCsPerMin ?? 0,
          goldEarned: avgRow.avgGold ?? 0,
          visionScore: avgRow.avgVision ?? 0,
          games: avgRow.total ?? 0,
        }
      : null;

  return {
    summonerName,
    currentRank,
    championName: match.championName,
    matchupChampionName: match.matchupChampionName,
    result: match.result,
    kills: match.kills,
    deaths: match.deaths,
    assists: match.assists,
    cs: match.cs,
    csPerMin: match.csPerMin ?? 0,
    goldEarned: match.goldEarned ?? 0,
    visionScore: match.visionScore ?? 0,
    gameDurationMin: Math.round(match.gameDurationSeconds / 60),
    runeKeystoneName: match.runeKeystoneName,
    comment: match.comment,
    reviewNotes: match.reviewNotes,
    highlights: highlightRows,
    championAvgStats,
    matchupNotes: noteContent,
    activeActionItems: actionItems,
    activeGoals: activeGoalRows,
  };
}

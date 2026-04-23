// ─── Achievement System ──────────────────────────────────────────────────────
// Static achievement definitions + evaluation logic.
// Rule: every achievement must be earnable by a new user from day one.
// No exclusive, time-gated, or "you had to be there" achievements.

import { eq, and, sql, count, countDistinct, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  userAchievements,
  matches,
  coachingSessions,
  coachingActionItems,
  challenges,
  matchHighlights,
  riotAccounts,
  users,
} from "@/db/schema";

// ─── Tier System ─────────────────────────────────────────────────────────────

export const TIER_NAMES = ["iron", "bronze", "silver", "gold", "platinum", "diamond"] as const;

export type TierName = (typeof TIER_NAMES)[number];

export function getTierName(tier: number): TierName {
  return TIER_NAMES[Math.min(tier - 1, TIER_NAMES.length - 1)] ?? "iron";
}

// ─── Category Definitions ────────────────────────────────────────────────────

export const ACHIEVEMENT_CATEGORIES = [
  "coaching",
  "challenges",
  "reviews",
  "matches",
  "combat",
  "highlights",
  "general",
] as const;

export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

// ─── Achievement Definition Types ────────────────────────────────────────────

export interface TieredAchievementDef {
  id: string;
  category: AchievementCategory;
  icon: string; // Lucide icon name
  secret: false;
  tiers: number[]; // thresholds for each tier (length = max tier)
}

export interface OneOffAchievementDef {
  id: string;
  category: AchievementCategory;
  icon: string;
  secret: boolean;
  tiers: null;
}

export type AchievementDef = TieredAchievementDef | OneOffAchievementDef;

// ─── Achievement Definitions ─────────────────────────────────────────────────
// All 30 achievements. i18n keys are derived from the id:
//   Achievements.<id>.title / Achievements.<id>.description

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Coaching ──
  {
    id: "coaching_sessions",
    category: "coaching",
    icon: "GraduationCap",
    secret: false,
    tiers: [5, 15, 30, 50, 75, 100],
  },
  {
    id: "action_items_completed",
    category: "coaching",
    icon: "ListChecks",
    secret: false,
    tiers: [5, 15, 30, 50, 75, 100],
  },

  // ── Challenges ──
  {
    id: "challenges_completed",
    category: "challenges",
    icon: "Target",
    secret: false,
    tiers: [3, 10, 25, 50, 75, 100],
  },
  {
    id: "challenges_failed",
    category: "challenges",
    icon: "ShieldOff",
    secret: false,
    tiers: [3, 10, 25, 50, 75, 100],
  },
  {
    id: "challenge_streak",
    category: "challenges",
    icon: "Flame",
    secret: false,
    tiers: [3, 5, 7, 10, 15, 20],
  },
  {
    id: "active_challenges",
    category: "challenges",
    icon: "Layers",
    secret: false,
    tiers: [2, 3, 4, 5],
  },
  {
    id: "denial",
    category: "challenges",
    icon: "Ban",
    secret: true,
    tiers: null,
  },

  // ── Reviews ──
  {
    id: "reviews_written",
    category: "reviews",
    icon: "ClipboardCheck",
    secret: false,
    tiers: [5, 15, 30, 50, 100, 200],
  },
  {
    id: "review_streak",
    category: "reviews",
    icon: "CalendarCheck",
    secret: false,
    tiers: [3, 7, 14, 21, 30, 60],
  },
  {
    id: "late_bloomer",
    category: "reviews",
    icon: "Clock",
    secret: true,
    tiers: null,
  },

  // ── Matches ──
  {
    id: "matches_tracked",
    category: "matches",
    icon: "Swords",
    secret: false,
    tiers: [25, 100, 250, 500, 750, 1000],
  },
  {
    id: "win_streak",
    category: "matches",
    icon: "TrendingUp",
    secret: false,
    tiers: [3, 5, 7, 10, 12, 15],
  },
  {
    id: "champions_played",
    category: "matches",
    icon: "Users",
    secret: false,
    tiers: [5, 10, 15, 25, 40, 60],
  },
  {
    id: "one_trick",
    category: "matches",
    icon: "Heart",
    secret: false,
    tiers: [20, 50, 100, 200, 500, 1000],
  },
  {
    id: "flawless",
    category: "matches",
    icon: "Crown",
    secret: false,
    tiers: null,
  },
  {
    id: "fill_main",
    category: "matches",
    icon: "Shuffle",
    secret: false,
    tiers: null,
  },
  {
    id: "the_marathon",
    category: "matches",
    icon: "Timer",
    secret: false,
    tiers: null,
  },
  {
    id: "speedrun",
    category: "matches",
    icon: "Zap",
    secret: false,
    tiers: null,
  },

  // ── Combat (funny) ──
  {
    id: "inting_is_an_art",
    category: "combat",
    icon: "Skull",
    secret: true,
    tiers: null,
  },
  {
    id: "kda_player",
    category: "combat",
    icon: "Star",
    secret: true,
    tiers: null,
  },
  {
    id: "cs_whats_that",
    category: "combat",
    icon: "HelpCircle",
    secret: true,
    tiers: null,
  },
  {
    id: "ghost_player",
    category: "combat",
    icon: "Ghost",
    secret: true,
    tiers: null,
  },
  {
    id: "vision_never_heard",
    category: "combat",
    icon: "EyeOff",
    secret: true,
    tiers: null,
  },
  {
    id: "walking_atm",
    category: "combat",
    icon: "Coins",
    secret: true,
    tiers: null,
  },

  // ── Highlights ──
  {
    id: "highlights_tagged",
    category: "highlights",
    icon: "Sparkles",
    secret: false,
    tiers: [5, 15, 30, 50, 75, 100],
  },
  {
    id: "spotlight_moment",
    category: "highlights",
    icon: "Sun",
    secret: false,
    tiers: null,
  },

  // ── General ──
  {
    id: "summoner_connected",
    category: "general",
    icon: "Link",
    secret: false,
    tiers: null,
  },
  {
    id: "smurf_detected",
    category: "general",
    icon: "UserPlus",
    secret: false,
    tiers: null,
  },
  {
    id: "on_the_rift",
    category: "general",
    icon: "Play",
    secret: false,
    tiers: null,
  },
  {
    id: "weekly_warrior",
    category: "general",
    icon: "Calendar",
    secret: false,
    tiers: [3, 7, 14, 21, 30, 60],
  },
];

export function getAchievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

// ─── Transition Type (sent to client for modal) ─────────────────────────────

export interface AchievementTransition {
  achievementId: string;
  type: "unlock" | "tier_up";
  tier: number | null; // new tier (null for one-off)
  previousTier: number | null; // previous tier (null for first unlock)
}

// ─── Evaluation Context ──────────────────────────────────────────────────────

interface EvalContext {
  userId: string;
  // Counts
  coachingSessionsCompleted: number;
  actionItemsCompleted: number;
  challengesCompleted: number;
  challengesFailed: number;
  challengeStreak: number; // consecutive completed without a fail
  activeChallenges: number;
  failStreak: number; // consecutive failed challenges
  reviewsWritten: number;
  reviewStreakDays: number;
  hasLateReview: boolean; // reviewed a match 7+ days after playing
  matchesTracked: number;
  bestWinStreak: number;
  uniqueChampions: number;
  maxChampionGames: number; // most games on a single champion
  uniquePositions: number;
  hasFlawlessWin: boolean; // 0 deaths + win
  hasMarathonGame: boolean; // 45+ min game
  hasSpeedrunWin: boolean; // < 20 min win
  // Combat (funny)
  hasIntingGame: boolean; // 15+ deaths
  hasKdaGame: boolean; // 10+ kills, 0 deaths, 10+ assists, win
  hasLowCsWin: boolean; // < 3 cs/min, win
  hasGhostWin: boolean; // 0 kills, 0 assists, win
  hasNoVisionWin: boolean; // 0 vision score, win
  hasWalkingAtm: boolean; // 10+ deaths, win
  // Highlights
  highlightsTagged: number;
  hasAnyHighlight: boolean;
  // General
  riotAccountsLinked: number;
  consecutiveDays: number;
}

// ─── Build Evaluation Context ────────────────────────────────────────────────

async function buildEvalContext(userId: string): Promise<EvalContext> {
  // Run all queries in parallel
  const [
    coachingResult,
    actionItemResult,
    challengeCompletedResult,
    challengeFailedResult,
    activeChallengesResult,
    challengeHistory,
    reviewResult,
    matchCount,
    uniqueChampResult,
    maxChampResult,
    uniquePosResult,
    highlightCount,
    riotAccountCount,
    matchStats,
    reviewDates,
    matchDatesForStreak,
  ] = await Promise.all([
    // Coaching sessions completed
    db
      .select({ count: count() })
      .from(coachingSessions)
      .where(and(eq(coachingSessions.userId, userId), eq(coachingSessions.status, "completed"))),
    // Action items completed
    db
      .select({ count: count() })
      .from(coachingActionItems)
      .where(
        and(eq(coachingActionItems.userId, userId), eq(coachingActionItems.status, "completed")),
      ),
    // Challenges completed
    db
      .select({ count: count() })
      .from(challenges)
      .where(and(eq(challenges.userId, userId), eq(challenges.status, "completed"))),
    // Challenges failed
    db
      .select({ count: count() })
      .from(challenges)
      .where(and(eq(challenges.userId, userId), eq(challenges.status, "failed"))),
    // Active challenges
    db
      .select({ count: count() })
      .from(challenges)
      .where(and(eq(challenges.userId, userId), eq(challenges.status, "active"))),
    // Challenge history (ordered by completion/failure date) for streak calculation
    db
      .select({
        status: challenges.status,
        completedAt: challenges.completedAt,
        failedAt: challenges.failedAt,
      })
      .from(challenges)
      .where(
        and(eq(challenges.userId, userId), sql`${challenges.status} IN ('completed', 'failed')`),
      )
      .orderBy(sql`COALESCE(${challenges.completedAt}, ${challenges.failedAt}) DESC`),
    // Reviews written (matches with reviewed = true)
    db
      .select({ count: count() })
      .from(matches)
      .where(and(eq(matches.userId, userId), eq(matches.reviewed, true))),
    // Total matches
    db
      .select({ count: count() })
      .from(matches)
      .where(and(eq(matches.userId, userId), ne(matches.result, "Remake"))),
    // Unique champions
    db
      .select({ count: countDistinct(matches.championName) })
      .from(matches)
      .where(and(eq(matches.userId, userId), ne(matches.result, "Remake"))),
    // Max games on one champion
    db
      .select({ cnt: count() })
      .from(matches)
      .where(and(eq(matches.userId, userId), ne(matches.result, "Remake")))
      .groupBy(matches.championName)
      .orderBy(sql`count(*) DESC`)
      .limit(1),
    // Unique positions
    db
      .select({ count: countDistinct(matches.position) })
      .from(matches)
      .where(
        and(
          eq(matches.userId, userId),
          ne(matches.result, "Remake"),
          sql`${matches.position} IS NOT NULL`,
        ),
      ),
    // Highlights count
    db.select({ count: count() }).from(matchHighlights).where(eq(matchHighlights.userId, userId)),
    // Riot accounts linked
    db.select({ count: count() }).from(riotAccounts).where(eq(riotAccounts.userId, userId)),
    // Match-level stats for combat achievements + win streak
    db
      .select({
        result: matches.result,
        kills: matches.kills,
        deaths: matches.deaths,
        assists: matches.assists,
        csPerMin: matches.csPerMin,
        visionScore: matches.visionScore,
        gameDurationSeconds: matches.gameDurationSeconds,
      })
      .from(matches)
      .where(and(eq(matches.userId, userId), ne(matches.result, "Remake")))
      .orderBy(sql`${matches.gameDate} DESC`),
    // Review dates — for review streak calculation
    db
      .select({
        gameDate: matches.gameDate,
      })
      .from(matches)
      .where(and(eq(matches.userId, userId), eq(matches.reviewed, true)))
      .orderBy(sql`${matches.gameDate} DESC`),
    // Match dates for consecutive days calculation
    db
      .select({
        gameDate: matches.gameDate,
      })
      .from(matches)
      .where(and(eq(matches.userId, userId), ne(matches.result, "Remake")))
      .orderBy(sql`${matches.gameDate} DESC`),
  ]);

  // Calculate challenge streak (consecutive completed without a fail, most recent first)
  let challengeWinStreak = 0;
  let challengeFailStreak = 0;
  for (const ch of challengeHistory) {
    if (ch.status === "completed") {
      challengeWinStreak++;
    } else {
      break;
    }
  }
  // Also count fail streak for "denial" achievement
  for (const ch of challengeHistory) {
    if (ch.status === "failed") {
      challengeFailStreak++;
    } else {
      break;
    }
  }

  // Calculate best win streak from match history
  let bestWinStreak = 0;
  let currentWinStreak = 0;
  for (const m of matchStats) {
    if (m.result === "Victory") {
      currentWinStreak++;
      bestWinStreak = Math.max(bestWinStreak, currentWinStreak);
    } else {
      currentWinStreak = 0;
    }
  }

  // Combat achievement checks
  let hasFlawlessWin = false;
  let hasMarathonGame = false;
  let hasSpeedrunWin = false;
  let hasIntingGame = false;
  let hasKdaGame = false;
  let hasLowCsWin = false;
  let hasGhostWin = false;
  let hasNoVisionWin = false;
  let hasWalkingAtm = false;

  for (const m of matchStats) {
    const isWin = m.result === "Victory";
    if (isWin && m.deaths === 0) hasFlawlessWin = true;
    if ((m.gameDurationSeconds ?? 0) >= 45 * 60) hasMarathonGame = true;
    if (isWin && (m.gameDurationSeconds ?? Infinity) < 20 * 60) hasSpeedrunWin = true;
    if ((m.deaths ?? 0) >= 15) hasIntingGame = true;
    if (isWin && (m.kills ?? 0) >= 10 && m.deaths === 0 && (m.assists ?? 0) >= 10)
      hasKdaGame = true;
    if (isWin && (m.csPerMin ?? Infinity) < 3) hasLowCsWin = true;
    if (isWin && m.kills === 0 && m.assists === 0) hasGhostWin = true;
    if (isWin && (m.visionScore ?? 1) === 0) hasNoVisionWin = true;
    if (isWin && (m.deaths ?? 0) >= 10) hasWalkingAtm = true;
  }

  // Late review check: any match reviewed 7+ days after game date
  // We'd need reviewed_at timestamp which we don't have. Instead, check if
  // there's a reviewed match whose game date is 7+ days old at the time of review.
  // Since we don't track review timestamp, we'll approximate: any reviewed match
  // whose game date is more than 7 days before current time.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const hasLateReview = reviewDates.some((r) => r.gameDate && r.gameDate < sevenDaysAgo);

  // Review streak: consecutive days with at least one review
  const reviewStreakDays = calculateConsecutiveDays(
    reviewDates.map((r) => r.gameDate).filter(Boolean) as Date[],
  );

  // Consecutive days using the app (based on match dates)
  const consecutiveDays = calculateConsecutiveDays(
    matchDatesForStreak.map((m) => m.gameDate).filter(Boolean) as Date[],
  );

  return {
    userId,
    coachingSessionsCompleted: coachingResult[0]?.count ?? 0,
    actionItemsCompleted: actionItemResult[0]?.count ?? 0,
    challengesCompleted: challengeCompletedResult[0]?.count ?? 0,
    challengesFailed: challengeFailedResult[0]?.count ?? 0,
    challengeStreak: challengeWinStreak,
    activeChallenges: activeChallengesResult[0]?.count ?? 0,
    failStreak: challengeFailStreak,
    reviewsWritten: reviewResult[0]?.count ?? 0,
    reviewStreakDays,
    hasLateReview,
    matchesTracked: matchCount[0]?.count ?? 0,
    bestWinStreak,
    uniqueChampions: uniqueChampResult[0]?.count ?? 0,
    maxChampionGames: maxChampResult[0]?.cnt ?? 0,
    uniquePositions: uniquePosResult[0]?.count ?? 0,
    hasFlawlessWin,
    hasMarathonGame,
    hasSpeedrunWin,
    hasIntingGame,
    hasKdaGame,
    hasLowCsWin,
    hasGhostWin,
    hasNoVisionWin,
    hasWalkingAtm,
    highlightsTagged: highlightCount[0]?.count ?? 0,
    hasAnyHighlight: (highlightCount[0]?.count ?? 0) > 0,
    riotAccountsLinked: riotAccountCount[0]?.count ?? 0,
    consecutiveDays,
  };
}

/** Calculate the longest streak of consecutive unique calendar days from a list of dates. */
function calculateConsecutiveDays(dates: Date[]): number {
  if (dates.length === 0) return 0;

  // Get unique day strings, sorted descending
  const uniqueDays = [...new Set(dates.map((d) => d.toISOString().slice(0, 10)))].sort().reverse();

  if (uniqueDays.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]!);
    const curr = new Date(uniqueDays[i]!);
    const diffMs = prev.getTime() - curr.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

// ─── Evaluate Single Achievement ─────────────────────────────────────────────

function evaluateSingle(
  def: AchievementDef,
  ctx: EvalContext,
): { unlocked: boolean; tier: number | null; progress: number } {
  // Get the current metric value for this achievement
  const value = getMetricValue(def.id, ctx);

  if (def.tiers) {
    // Tiered: find the highest tier the user qualifies for
    let qualifiedTier = 0;
    for (let i = 0; i < def.tiers.length; i++) {
      if (value >= def.tiers[i]!) {
        qualifiedTier = i + 1;
      }
    }
    return {
      unlocked: qualifiedTier > 0,
      tier: qualifiedTier > 0 ? qualifiedTier : null,
      progress: value,
    };
  } else {
    // One-off: boolean check
    return {
      unlocked: value >= 1,
      tier: null,
      progress: value,
    };
  }
}

/** Map achievement ID to its numeric metric value from the eval context. */
function getMetricValue(id: string, ctx: EvalContext): number {
  switch (id) {
    // Coaching
    case "coaching_sessions":
      return ctx.coachingSessionsCompleted;
    case "action_items_completed":
      return ctx.actionItemsCompleted;
    // Challenges
    case "challenges_completed":
      return ctx.challengesCompleted;
    case "challenges_failed":
      return ctx.challengesFailed;
    case "challenge_streak":
      return ctx.challengeStreak;
    case "active_challenges":
      return ctx.activeChallenges;
    case "denial":
      return ctx.failStreak >= 3 ? 1 : 0;
    // Reviews
    case "reviews_written":
      return ctx.reviewsWritten;
    case "review_streak":
      return ctx.reviewStreakDays;
    case "late_bloomer":
      return ctx.hasLateReview ? 1 : 0;
    // Matches
    case "matches_tracked":
      return ctx.matchesTracked;
    case "win_streak":
      return ctx.bestWinStreak;
    case "champions_played":
      return ctx.uniqueChampions;
    case "one_trick":
      return ctx.maxChampionGames;
    case "flawless":
      return ctx.hasFlawlessWin ? 1 : 0;
    case "fill_main":
      return ctx.uniquePositions >= 5 ? 1 : 0;
    case "the_marathon":
      return ctx.hasMarathonGame ? 1 : 0;
    case "speedrun":
      return ctx.hasSpeedrunWin ? 1 : 0;
    // Combat
    case "inting_is_an_art":
      return ctx.hasIntingGame ? 1 : 0;
    case "kda_player":
      return ctx.hasKdaGame ? 1 : 0;
    case "cs_whats_that":
      return ctx.hasLowCsWin ? 1 : 0;
    case "ghost_player":
      return ctx.hasGhostWin ? 1 : 0;
    case "vision_never_heard":
      return ctx.hasNoVisionWin ? 1 : 0;
    case "walking_atm":
      return ctx.hasWalkingAtm ? 1 : 0;
    // Highlights
    case "highlights_tagged":
      return ctx.highlightsTagged;
    case "spotlight_moment":
      return ctx.hasAnyHighlight ? 1 : 0;
    // General
    case "summoner_connected":
      return ctx.riotAccountsLinked > 0 ? 1 : 0;
    case "smurf_detected":
      return ctx.riotAccountsLinked >= 2 ? 1 : 0;
    case "on_the_rift":
      return ctx.matchesTracked > 0 ? 1 : 0;
    case "weekly_warrior":
      return ctx.consecutiveDays;
    default:
      return 0;
  }
}

// ─── Main Evaluation Function ────────────────────────────────────────────────

/**
 * Evaluate all achievements for a user. Idempotent — safe to call multiple times.
 * Returns newly unlocked achievements and tier-ups for the modal.
 */
export async function evaluateAchievements(userId: string): Promise<AchievementTransition[]> {
  const [ctx, existing] = await Promise.all([
    buildEvalContext(userId),
    db.select().from(userAchievements).where(eq(userAchievements.userId, userId)),
  ]);

  const existingMap = new Map(existing.map((e) => [e.achievementId, e]));

  const transitions: AchievementTransition[] = [];
  const now = new Date();

  for (const def of ACHIEVEMENTS) {
    const result = evaluateSingle(def, ctx);

    if (!result.unlocked) continue;

    const existingRecord = existingMap.get(def.id);

    if (!existingRecord) {
      // New unlock
      await db.insert(userAchievements).values({
        achievementId: def.id,
        userId,
        tier: result.tier,
        unlockedAt: now,
        updatedAt: now,
      });
      transitions.push({
        achievementId: def.id,
        type: "unlock",
        tier: result.tier,
        previousTier: null,
      });
    } else if (
      result.tier !== null &&
      existingRecord.tier !== null &&
      result.tier > existingRecord.tier
    ) {
      // Tier up
      await db
        .update(userAchievements)
        .set({ tier: result.tier, updatedAt: now })
        .where(
          and(eq(userAchievements.achievementId, def.id), eq(userAchievements.userId, userId)),
        );
      transitions.push({
        achievementId: def.id,
        type: "tier_up",
        tier: result.tier,
        previousTier: existingRecord.tier,
      });
    }
    // else: already unlocked at same or higher tier — no-op
  }

  return transitions;
}

// ─── Progress Helpers (for UI) ───────────────────────────────────────────────

export interface AchievementProgress {
  def: AchievementDef;
  unlocked: boolean;
  currentTier: number | null;
  progress: number; // current metric value
  nextThreshold: number | null; // next tier threshold (null if max or one-off)
  unlockedAt: Date | null;
  updatedAt: Date | null;
}

/** Get progress for all achievements for display on the achievements page. */
export async function getAchievementProgress(userId: string): Promise<AchievementProgress[]> {
  const [ctx, existing] = await Promise.all([
    buildEvalContext(userId),
    db.select().from(userAchievements).where(eq(userAchievements.userId, userId)),
  ]);

  const existingMap = new Map(existing.map((e) => [e.achievementId, e]));

  return ACHIEVEMENTS.map((def) => {
    const result = evaluateSingle(def, ctx);
    const record = existingMap.get(def.id);

    let nextThreshold: number | null = null;
    if (def.tiers) {
      const currentTier = record?.tier ?? 0;
      if (currentTier < def.tiers.length) {
        nextThreshold = def.tiers[currentTier] ?? null;
      }
    }

    return {
      def,
      unlocked: !!record,
      currentTier: record?.tier ?? null,
      progress: result.progress,
      nextThreshold,
      unlockedAt: record?.unlockedAt ?? null,
      updatedAt: record?.updatedAt ?? null,
    };
  });
}

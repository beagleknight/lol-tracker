import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  unique,
} from "drizzle-orm/sqlite-core";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // Generated UUID
  discordId: text("discord_id").unique().notNull(),
  name: text("name"),
  image: text("image"),
  email: text("email"),
  riotGameName: text("riot_game_name"), // Cache of active Riot account's gameName
  riotTagLine: text("riot_tag_line"), // Cache of active Riot account's tagLine
  puuid: text("puuid"), // Cache of active Riot account's PUUID
  summonerId: text("summoner_id"),
  duoPartnerUserId: text("duo_partner_user_id"),
  region: text("region"), // Cache of active Riot account's region
  activeRiotAccountId: text("active_riot_account_id"), // FK to riotAccounts.id (set after table exists)
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" })
    .notNull()
    .default(false),
  primaryRole: text("primary_role"), // Preferred primary position: TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
  secondaryRole: text("secondary_role"), // Preferred secondary position
  coachingCadenceDays: integer("coaching_cadence_days").notNull().default(14), // How often to schedule coaching (days)
  locale: text("locale").default("en-GB"),
  language: text("language").default("en"),
  role: text("role", { enum: ["admin", "premium", "free"] })
    .notNull()
    .default("free"),
  deactivatedAt: integer("deactivated_at", { mode: "timestamp" }), // null = active
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Riot Accounts ───────────────────────────────────────────────────────────
// One user can link up to 5 Riot accounts (main + smurfs).
// One account is marked as primary (first linked by default, changeable).
// The user's activeRiotAccountId determines which account is currently in use.

export const riotAccounts = sqliteTable(
  "riot_accounts",
  {
    id: text("id").primaryKey(), // Generated UUID
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    puuid: text("puuid").notNull(),
    riotGameName: text("riot_game_name").notNull(),
    riotTagLine: text("riot_tag_line").notNull(),
    summonerId: text("summoner_id"),
    region: text("region").notNull(), // Riot platform region: euw1, na1, kr, eun1, etc.
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    discoverable: integer("discoverable", { mode: "boolean" }).notNull().default(true), // Whether this account appears in duo partner search results
    label: text("label"), // User-friendly nickname, e.g. "Main", "Smurf"
    primaryRole: text("primary_role"), // Preferred primary position: TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
    secondaryRole: text("secondary_role"), // Preferred secondary position
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    unique("riot_accounts_user_puuid_unq").on(table.userId, table.puuid),
    index("riot_accounts_user_idx").on(table.userId),
  ],
);

// ─── Matches ─────────────────────────────────────────────────────────────────

export const matches = sqliteTable(
  "matches",
  {
    id: text("id").notNull(), // Riot match ID e.g. "EUW1_7234567890"
    odometer: integer("odometer").notNull(), // Per-user sort key
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    riotAccountId: text("riot_account_id").references(() => riotAccounts.id, {
      onDelete: "set null",
    }),
    gameDate: integer("game_date", { mode: "timestamp" }).notNull(),
    result: text("result", { enum: ["Victory", "Defeat", "Remake"] }).notNull(),
    championId: integer("champion_id").notNull(),
    championName: text("champion_name").notNull(),
    runeKeystoneId: integer("rune_keystone_id"),
    runeKeystoneName: text("rune_keystone_name"),
    matchupChampionId: integer("matchup_champion_id"),
    matchupChampionName: text("matchup_champion_name"),
    kills: integer("kills").notNull().default(0),
    deaths: integer("deaths").notNull().default(0),
    assists: integer("assists").notNull().default(0),
    cs: integer("cs").notNull().default(0),
    csPerMin: real("cs_per_min").default(0),
    gameDurationSeconds: integer("game_duration_seconds").notNull().default(0),
    goldEarned: integer("gold_earned").default(0),
    visionScore: integer("vision_score").default(0),
    // Manual fields (user editable)
    comment: text("comment"),
    reviewed: integer("reviewed", { mode: "boolean" }).notNull().default(false),
    reviewNotes: text("review_notes"),
    reviewSkippedReason: text("review_skipped_reason"), // e.g. "Already know what went wrong"
    vodUrl: text("vod_url"), // Ascent VOD link
    // Metadata
    queueId: integer("queue_id"), // 420 = Solo/Duo
    position: text("position"), // TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
    syncedAt: integer("synced_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    rawMatchJson: text("raw_match_json"),
    duoPartnerPuuid: text("duo_partner_puuid"), // Set if duo partner was on same team
    // Denormalized duo partner stats (extracted from rawMatchJson during sync/backfill)
    duoPartnerChampionName: text("duo_partner_champion_name"),
    duoPartnerKills: integer("duo_partner_kills"),
    duoPartnerDeaths: integer("duo_partner_deaths"),
    duoPartnerAssists: integer("duo_partner_assists"),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.userId] }),
    unique("matches_user_odometer_unq").on(table.userId, table.odometer),
    index("matches_user_game_date_idx").on(table.userId, table.gameDate),
    index("matches_user_reviewed_idx").on(table.userId, table.reviewed),
    index("matches_user_duo_partner_idx").on(table.userId, table.duoPartnerPuuid),
    index("matches_user_position_idx").on(table.userId, table.position),
    index("matches_riot_account_idx").on(table.riotAccountId),
  ],
);

// ─── Rank Snapshots ──────────────────────────────────────────────────────────

export const rankSnapshots = sqliteTable(
  "rank_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    riotAccountId: text("riot_account_id").references(() => riotAccounts.id, {
      onDelete: "set null",
    }),
    capturedAt: integer("captured_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    tier: text("tier"), // e.g. "GOLD"
    division: text("division"), // e.g. "II"
    lp: integer("lp").default(0),
    wins: integer("wins").default(0),
    losses: integer("losses").default(0),
  },
  (table) => [
    index("rank_snapshots_user_captured_idx").on(table.userId, table.capturedAt),
    index("rank_snapshots_riot_account_idx").on(table.riotAccountId),
  ],
);

// ─── Coaching Sessions ───────────────────────────────────────────────────────

export const coachingSessions = sqliteTable(
  "coaching_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    coachName: text("coach_name").notNull(),
    date: integer("date", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: ["scheduled", "completed"] })
      .notNull()
      .default("scheduled"),
    vodMatchId: text("vod_match_id"), // The specific match/VOD to review
    durationMinutes: integer("duration_minutes"),
    focusAreas: text("focus_areas"), // JSON array — original pre-session focus areas (preserved after completion)
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("coaching_sessions_user_date_idx").on(table.userId, table.date),
    index("coaching_sessions_user_status_idx").on(table.userId, table.status),
  ],
);

// ─── Coaching Session <-> Matches (many-to-many) ─────────────────────────────

export const coachingSessionMatches = sqliteTable(
  "coaching_session_matches",
  {
    sessionId: integer("session_id")
      .notNull()
      .references(() => coachingSessions.id, { onDelete: "cascade" }),
    matchId: text("match_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.matchId] }),
    index("coaching_session_matches_match_user_idx").on(table.matchId, table.userId),
  ],
);

// ─── Coaching Action Items ───────────────────────────────────────────────────

export const coachingActionItems = sqliteTable(
  "coaching_action_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id").references(() => coachingSessions.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    topicId: integer("topic_id").references(() => topics.id, { onDelete: "set null" }),
    status: text("status", {
      enum: ["pending", "in_progress", "completed"],
    })
      .notNull()
      .default("pending"),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("action_items_user_status_idx").on(table.userId, table.status),
    index("action_items_session_idx").on(table.sessionId),
    index("action_items_topic_idx").on(table.topicId),
  ],
);

// ─── Invites ─────────────────────────────────────────────────────────────────

export const invites = sqliteTable("invites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  usedBy: text("used_by").references(() => users.id, { onDelete: "set null" }),
  usedAt: integer("used_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }), // null = never expires (legacy)
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Topics ─────────────────────────────────────────────────────────────────
// Normalized topic entity. Default topics are shared across all users.
// Future: users can create custom topics (isDefault=false, userId set).

export const topics = sqliteTable(
  "topics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(true),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }), // null for default topics
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("topics_user_idx").on(table.userId)],
);

// ─── Coaching Session <-> Topics (many-to-many) ─────────────────────────────

export const coachingSessionTopics = sqliteTable(
  "coaching_session_topics",
  {
    sessionId: integer("session_id")
      .notNull()
      .references(() => coachingSessions.id, { onDelete: "cascade" }),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.topicId] }),
    index("coaching_session_topics_topic_idx").on(table.topicId),
  ],
);

// ─── Match Highlights / Lowlights ────────────────────────────────────────────

export const matchHighlights = sqliteTable(
  "match_highlights",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    matchId: text("match_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    riotAccountId: text("riot_account_id").references(() => riotAccounts.id, {
      onDelete: "set null",
    }),
    type: text("type", { enum: ["highlight", "lowlight"] }).notNull(),
    text: text("text").notNull(),
    topicId: integer("topic_id").references(() => topics.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("match_highlights_match_user_idx").on(table.matchId, table.userId),
    index("match_highlights_user_idx").on(table.userId),
    index("match_highlights_topic_idx").on(table.topicId),
  ],
);

// ─── Challenges ──────────────────────────────────────────────────────────────
// Replaces the old "goals" system. Supports multiple concurrent challenges
// of different types: reach a rank by a date, or track a metric over N games.

export const challenges = sqliteTable(
  "challenges",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    riotAccountId: text("riot_account_id").references(() => riotAccounts.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(), // e.g. "Reach Platinum IV" or "Keep CSPM above 7 for 10 games"

    // Challenge type: by-date (rank target) or by-games (metric condition over N games)
    type: text("type", { enum: ["by-date", "by-games"] }).notNull(),

    // ── by-date fields (rank target) ──
    targetTier: text("target_tier"), // e.g. "PLATINUM" (null for by-games)
    targetDivision: text("target_division"), // e.g. "IV" (null for Master+ or by-games)
    startTier: text("start_tier"), // captured at creation (null for by-games)
    startDivision: text("start_division"),
    startLp: integer("start_lp").default(0),
    deadline: integer("deadline", { mode: "timestamp" }), // soft deadline

    // ── by-games fields (metric condition over N games) ──
    metric: text("metric"), // e.g. "cspm", "deaths", "vision_score"
    metricCondition: text("metric_condition", {
      enum: ["at_least", "at_most"],
    }), // inclusive comparison: >= or <=
    metricThreshold: real("metric_threshold"), // e.g. 7.0 for "CSPM above 7"
    targetGames: integer("target_games"), // e.g. 10 for "over 10 games"
    currentGames: integer("current_games").default(0), // games evaluated so far
    successfulGames: integer("successful_games").default(0), // games meeting condition

    // Status lifecycle: active → completed | failed | retired
    status: text("status", {
      enum: ["active", "completed", "failed", "retired"],
    })
      .notNull()
      .default("active"),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    failedAt: integer("failed_at", { mode: "timestamp" }),
    retiredAt: integer("retired_at", { mode: "timestamp" }),
  },
  (table) => [
    index("challenges_user_status_idx").on(table.userId, table.status),
    index("challenges_user_type_idx").on(table.userId, table.type),
  ],
);

// ─── Challenge <-> Topics (many-to-many) ────────────────────────────────────

export const challengeTopics = sqliteTable(
  "challenge_topics",
  {
    challengeId: integer("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.challengeId, table.topicId] }),
    index("challenge_topics_topic_idx").on(table.topicId),
  ],
);

// ─── Legacy Goals (kept for migration reference, will be dropped later) ─────

export const goals = sqliteTable(
  "goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    riotAccountId: text("riot_account_id").references(() => riotAccounts.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    targetTier: text("target_tier").notNull(),
    targetDivision: text("target_division"),
    startTier: text("start_tier").notNull(),
    startDivision: text("start_division"),
    startLp: integer("start_lp").notNull().default(0),
    status: text("status", { enum: ["active", "achieved", "retired"] })
      .notNull()
      .default("active"),
    deadline: integer("deadline", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    achievedAt: integer("achieved_at", { mode: "timestamp" }),
    retiredAt: integer("retired_at", { mode: "timestamp" }),
  },
  (table) => [index("goals_user_status_idx").on(table.userId, table.status)],
);

// ─── Matchup Notes ──────────────────────────────────────────────────────────

export const matchupNotes = sqliteTable(
  "matchup_notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    championName: text("champion_name"), // null = general note for this enemy
    matchupChampionName: text("matchup_champion_name").notNull(), // the enemy champion
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    unique("matchup_notes_user_champ_matchup_unq").on(
      table.userId,
      table.championName,
      table.matchupChampionName,
    ),
    index("matchup_notes_user_matchup_idx").on(table.userId, table.matchupChampionName),
  ],
);

// ─── AI Insights ────────────────────────────────────────────────────────────

export const aiInsights = sqliteTable(
  "ai_insights",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    riotAccountId: text("riot_account_id").references(() => riotAccounts.id, {
      onDelete: "set null",
    }),
    type: text("type", { enum: ["matchup", "post-game"] }).notNull(),
    contextKey: text("context_key").notNull(), // e.g. "ahri-vs-zed" or match ID
    content: text("content").notNull(),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    unique("ai_insights_user_type_context_unq").on(table.userId, table.type, table.contextKey),
    index("ai_insights_user_created_idx").on(table.userId, table.createdAt),
  ],
);

// ─── Rate Limit Events ──────────────────────────────────────────────────────

export const rateLimitEvents = sqliteTable(
  "rate_limit_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(), // e.g. "sync", "export", "ai_insight", "riot_lookup"
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("rate_limit_events_user_action_created_idx").on(
      table.userId,
      table.action,
      table.createdAt,
    ),
  ],
);

// ─── Sync Locks ─────────────────────────────────────────────────────────────

export const syncLocks = sqliteTable("sync_locks", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  lockedAt: integer("locked_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

// ─── Type Exports ────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type RiotAccount = typeof riotAccounts.$inferSelect;
export type Match = typeof matches.$inferSelect;
/** The result column's union type, derived from the schema enum. */
export type MatchResult = Match["result"];
export type RankSnapshot = typeof rankSnapshots.$inferSelect;
export type CoachingSession = typeof coachingSessions.$inferSelect;
export type CoachingActionItem = typeof coachingActionItems.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
export type ChallengeTopicRow = typeof challengeTopics.$inferSelect;
export type MatchHighlight = typeof matchHighlights.$inferSelect;
export type MatchupNote = typeof matchupNotes.$inferSelect;
export type AiInsight = typeof aiInsights.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type SyncLock = typeof syncLocks.$inferSelect;
export type RateLimitEvent = typeof rateLimitEvents.$inferSelect;

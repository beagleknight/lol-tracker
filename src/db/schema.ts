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
  riotGameName: text("riot_game_name"),
  riotTagLine: text("riot_tag_line"),
  puuid: text("puuid"),
  summonerId: text("summoner_id"),
  duoPartnerUserId: text("duo_partner_user_id"),
  locale: text("locale").default("en-GB"),
  language: text("language").default("en"),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Matches ─────────────────────────────────────────────────────────────────

export const matches = sqliteTable(
  "matches",
  {
    id: text("id").notNull(), // Riot match ID e.g. "EUW1_7234567890"
    odometer: integer("odometer").notNull(), // Per-user sort key
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
    capturedAt: integer("captured_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    tier: text("tier"), // e.g. "GOLD"
    division: text("division"), // e.g. "II"
    lp: integer("lp").default(0),
    wins: integer("wins").default(0),
    losses: integer("losses").default(0),
  },
  (table) => [index("rank_snapshots_user_captured_idx").on(table.userId, table.capturedAt)],
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
    topics: text("topics"), // JSON array string e.g. '["laning","wave management"]'
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
    topic: text("topic"),
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
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Match Highlights / Lowlights ────────────────────────────────────────────

export const matchHighlights = sqliteTable(
  "match_highlights",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    matchId: text("match_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["highlight", "lowlight"] }).notNull(),
    text: text("text").notNull(),
    topic: text("topic"), // Predefined topic from PREDEFINED_TOPICS, nullable
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("match_highlights_match_user_idx").on(table.matchId, table.userId),
    index("match_highlights_user_idx").on(table.userId),
  ],
);

// ─── Goals ───────────────────────────────────────────────────────────────────

export const goals = sqliteTable(
  "goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(), // e.g. "Reach Platinum IV"
    // Target rank
    targetTier: text("target_tier").notNull(), // e.g. "PLATINUM"
    targetDivision: text("target_division"), // e.g. "IV" (null for Master+)
    // Starting rank (captured at goal creation for progress calculation)
    startTier: text("start_tier").notNull(),
    startDivision: text("start_division"),
    startLp: integer("start_lp").notNull().default(0),
    // Status lifecycle: active → achieved | retired
    status: text("status", { enum: ["active", "achieved", "retired"] })
      .notNull()
      .default("active"),
    // Optional soft deadline
    deadline: integer("deadline", { mode: "timestamp" }),
    // Timestamps
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

// ─── Type Exports ────────────────────────────────────────────────────────────

export type Match = typeof matches.$inferSelect;
/** The result column's union type, derived from the schema enum. */
export type MatchResult = Match["result"];
export type RankSnapshot = typeof rankSnapshots.$inferSelect;
export type CoachingSession = typeof coachingSessions.$inferSelect;
export type CoachingActionItem = typeof coachingActionItems.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type MatchupNote = typeof matchupNotes.$inferSelect;
export type AiInsight = typeof aiInsights.$inferSelect;

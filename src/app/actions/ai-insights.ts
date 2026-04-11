"use server";

import { generateText } from "ai";
import { eq, and, sql } from "drizzle-orm";

import type { MatchupReport } from "@/app/actions/live";

import { db } from "@/db";
import { aiInsights } from "@/db/schema";
import { buildMatchupContext } from "@/lib/ai/context";
import { buildPostGameContext } from "@/lib/ai/context";
import { buildMatchupPrompt, buildPostGamePrompt } from "@/lib/ai/prompts";
import { aiModel, isAiConfigured, AI_MODEL_ID } from "@/lib/ai/provider";
import { checkRateLimit } from "@/lib/rate-limit";
import { blockIfImpersonating, isPremium, requireUser } from "@/lib/session";

// ─── Constants ──────────────────────────────────────────────────────────────

const PREMIUM_DAILY_LIMIT = 10;
const FREE_DAILY_LIMIT = 0;

// ─── Types ──────────────────────────────────────────────────────────────────

export type InsightType = "matchup" | "post-game";

export interface InsightResult {
  content: string;
  cached: boolean;
  createdAt: Date;
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
}

export interface InsightError {
  error: string;
  limitReached?: boolean;
  premiumRequired?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function contextKey(type: InsightType, params: Record<string, string | undefined>): string {
  if (type === "matchup") {
    const your = params.yourChampion?.toLowerCase() || "any";
    const enemy = params.enemyChampion?.toLowerCase() || "unknown";
    return `${your}-vs-${enemy}`;
  }
  // post-game: use match ID
  return params.matchId || "unknown";
}

async function getDailyUsage(userId: string, riotAccountId: string | null): Promise<number> {
  const conditions = [
    eq(aiInsights.userId, userId),
    sql`${aiInsights.createdAt} >= ${Math.floor(todayStart().getTime() / 1000)}`,
  ];
  if (riotAccountId) {
    conditions.push(eq(aiInsights.riotAccountId, riotAccountId));
  }
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(aiInsights)
    .where(and(...conditions));
  return row?.count ?? 0;
}

// ─── Check if AI is configured ──────────────────────────────────────────────

export async function checkAiConfigured(): Promise<boolean> {
  return isAiConfigured();
}

// ─── Get daily usage stats ──────────────────────────────────────────────────

export async function getAiDailyUsage(): Promise<{
  used: number;
  limit: number;
  premiumRequired: boolean;
}> {
  const user = await requireUser();
  const limit = isPremium(user) ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const used = await getDailyUsage(user.id, user.activeRiotAccountId ?? null);
  return { used, limit, premiumRequired: !isPremium(user) };
}

// ─── Get cached insight ─────────────────────────────────────────────────────

export async function getCachedInsight(
  type: InsightType,
  params: Record<string, string | undefined>,
): Promise<InsightResult | null> {
  const user = await requireUser();
  const key = contextKey(type, params);

  const conditions = [
    eq(aiInsights.userId, user.id),
    eq(aiInsights.type, type),
    eq(aiInsights.contextKey, key),
  ];
  if (user.activeRiotAccountId) {
    conditions.push(eq(aiInsights.riotAccountId, user.activeRiotAccountId));
  }

  const existing = await db.query.aiInsights.findFirst({
    where: and(...conditions),
  });

  if (!existing) return null;

  return {
    content: existing.content,
    cached: true,
    createdAt: existing.createdAt,
    model: existing.model,
    promptTokens: existing.promptTokens,
    completionTokens: existing.completionTokens,
  };
}

// ─── Generate Matchup Insight ───────────────────────────────────────────────

export async function generateMatchupInsight(
  enemyChampionName: string,
  yourChampionName: string | undefined,
  report: MatchupReport,
  forceRegenerate = false,
): Promise<InsightResult | InsightError> {
  const user = await requireUser();
  await blockIfImpersonating();

  if (!isAiConfigured()) {
    return { error: "AI insights are not configured." };
  }

  const key = contextKey("matchup", {
    yourChampion: yourChampionName,
    enemyChampion: enemyChampionName,
  });

  // Check cache (unless force-regenerating)
  if (!forceRegenerate) {
    const cacheConditions = [
      eq(aiInsights.userId, user.id),
      eq(aiInsights.type, "matchup"),
      eq(aiInsights.contextKey, key),
    ];
    if (user.activeRiotAccountId) {
      cacheConditions.push(eq(aiInsights.riotAccountId, user.activeRiotAccountId));
    }
    const existing = await db.query.aiInsights.findFirst({
      where: and(...cacheConditions),
    });

    if (existing) {
      return {
        content: existing.content,
        cached: true,
        createdAt: existing.createdAt,
        model: existing.model,
        promptTokens: existing.promptTokens,
        completionTokens: existing.completionTokens,
      };
    }
  }

  // Rate limit check (after cache — cached results don't count)
  const rateCheck = await checkRateLimit(user.id, "ai_insight");
  if (!rateCheck.allowed) {
    return {
      error: `Rate limit exceeded. Try again in ${rateCheck.retryAfter} seconds.`,
    };
  }

  // Check daily limit
  const used = await getDailyUsage(user.id, user.activeRiotAccountId ?? null);
  const dailyLimit = isPremium(user) ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;
  if (used >= dailyLimit) {
    if (!isPremium(user)) {
      return {
        error: "AI insights are a premium feature.",
        premiumRequired: true,
      };
    }
    return { error: "Daily insight limit reached.", limitReached: true };
  }

  // Build context and prompt
  const summonerName = user.riotGameName
    ? `${user.riotGameName}#${user.riotTagLine}`
    : user.name || "Player";

  const ctx = await buildMatchupContext(
    user.id,
    user.activeRiotAccountId ?? null,
    summonerName,
    enemyChampionName,
    yourChampionName,
    report,
  );

  const language = user.language || "en";
  const { system, prompt } = buildMatchupPrompt(ctx, language);

  try {
    const result = await generateText({
      model: aiModel,
      system,
      prompt,
    });

    // Upsert into DB (replace if regenerating)
    await db
      .insert(aiInsights)
      .values({
        userId: user.id,
        riotAccountId: user.activeRiotAccountId,
        type: "matchup",
        contextKey: key,
        content: result.text,
        model: AI_MODEL_ID,
        promptTokens: result.usage?.inputTokens ?? null,
        completionTokens: result.usage?.outputTokens ?? null,
      })
      .onConflictDoUpdate({
        target: [aiInsights.userId, aiInsights.type, aiInsights.contextKey],
        set: {
          content: result.text,
          model: AI_MODEL_ID,
          riotAccountId: user.activeRiotAccountId,
          promptTokens: result.usage?.inputTokens ?? null,
          completionTokens: result.usage?.outputTokens ?? null,
          createdAt: new Date(),
        },
      });

    return {
      content: result.text,
      cached: false,
      createdAt: new Date(),
      model: AI_MODEL_ID,
      promptTokens: result.usage?.inputTokens,
      completionTokens: result.usage?.outputTokens,
    };
  } catch (e) {
    console.error("[AI Insight] Matchup generation failed:", e);
    return { error: "Failed to generate insight. Please try again." };
  }
}

// ─── Generate Post-Game Insight ─────────────────────────────────────────────

export async function generatePostGameInsight(
  matchId: string,
  forceRegenerate = false,
): Promise<InsightResult | InsightError> {
  const user = await requireUser();
  await blockIfImpersonating();

  if (!isAiConfigured()) {
    return { error: "AI insights are not configured." };
  }

  const key = contextKey("post-game", { matchId });

  // Check cache
  if (!forceRegenerate) {
    const cacheConditions = [
      eq(aiInsights.userId, user.id),
      eq(aiInsights.type, "post-game"),
      eq(aiInsights.contextKey, key),
    ];
    if (user.activeRiotAccountId) {
      cacheConditions.push(eq(aiInsights.riotAccountId, user.activeRiotAccountId));
    }
    const existing = await db.query.aiInsights.findFirst({
      where: and(...cacheConditions),
    });

    if (existing) {
      return {
        content: existing.content,
        cached: true,
        createdAt: existing.createdAt,
        model: existing.model,
        promptTokens: existing.promptTokens,
        completionTokens: existing.completionTokens,
      };
    }
  }

  // Rate limit check (after cache — cached results don't count)
  const rateCheck = await checkRateLimit(user.id, "ai_insight");
  if (!rateCheck.allowed) {
    return {
      error: `Rate limit exceeded. Try again in ${rateCheck.retryAfter} seconds.`,
    };
  }

  // Check daily limit
  const used = await getDailyUsage(user.id, user.activeRiotAccountId ?? null);
  const dailyLimit = isPremium(user) ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;
  if (used >= dailyLimit) {
    if (!isPremium(user)) {
      return {
        error: "AI insights are a premium feature.",
        premiumRequired: true,
      };
    }
    return { error: "Daily insight limit reached.", limitReached: true };
  }

  // Build context
  const summonerName = user.riotGameName
    ? `${user.riotGameName}#${user.riotTagLine}`
    : user.name || "Player";

  const ctx = await buildPostGameContext(
    user.id,
    user.activeRiotAccountId ?? null,
    summonerName,
    matchId,
  );
  if (!ctx) {
    return { error: "Match not found." };
  }

  const language = user.language || "en";
  const { system, prompt } = buildPostGamePrompt(ctx, language);

  try {
    const result = await generateText({
      model: aiModel,
      system,
      prompt,
    });

    // Upsert into DB
    await db
      .insert(aiInsights)
      .values({
        userId: user.id,
        riotAccountId: user.activeRiotAccountId,
        type: "post-game",
        contextKey: key,
        content: result.text,
        model: AI_MODEL_ID,
        promptTokens: result.usage?.inputTokens ?? null,
        completionTokens: result.usage?.outputTokens ?? null,
      })
      .onConflictDoUpdate({
        target: [aiInsights.userId, aiInsights.type, aiInsights.contextKey],
        set: {
          content: result.text,
          model: AI_MODEL_ID,
          riotAccountId: user.activeRiotAccountId,
          promptTokens: result.usage?.inputTokens ?? null,
          completionTokens: result.usage?.outputTokens ?? null,
          createdAt: new Date(),
        },
      });

    return {
      content: result.text,
      cached: false,
      createdAt: new Date(),
      model: AI_MODEL_ID,
      promptTokens: result.usage?.inputTokens,
      completionTokens: result.usage?.outputTokens,
    };
  } catch (e) {
    console.error("[AI Insight] Post-game generation failed:", e);
    return { error: "Failed to generate insight. Please try again." };
  }
}

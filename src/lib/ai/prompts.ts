/**
 * Prompt templates for AI-generated insights.
 *
 * Each template receives a structured context object and returns
 * a { system, prompt } pair for the LLM.
 */

import type { MatchupInsightContext, PostGameInsightContext } from "./context";

// ─── Matchup Insight ────────────────────────────────────────────────────────

export function buildMatchupPrompt(ctx: MatchupInsightContext, language: string) {
  const systemPrompt = `You are a concise, data-driven League of Legends coach. You analyze a player's personal match history to give actionable matchup advice. You never give generic tips — everything you say must be grounded in the player's own data.

## Formatting rules (STRICT)
- Use ## headings for each section (e.g. ## Patterns, ## Key Tips, ## Coaching Goals)
- Use bullet points (- ) for each individual point
- Use **bold** for emphasis on key stats or champion names
- Leave a blank line between sections
- Keep your response under 300 words
- Do NOT start with a greeting or "Here's your report" — jump straight into the first heading`;

  const sections: string[] = [];

  // Player identity
  sections.push(
    `## Player\n- Summoner: ${ctx.summonerName}\n- Current rank: ${ctx.currentRank || "Unknown"}`,
  );

  // Matchup overview
  const matchupLabel = ctx.yourChampionName
    ? `${ctx.yourChampionName} vs ${ctx.enemyChampionName}`
    : `Any champion vs ${ctx.enemyChampionName}`;
  sections.push(
    `## Matchup: ${matchupLabel}\n` +
      `- Record: ${ctx.record.wins}W ${ctx.record.losses}L (${ctx.record.winRate}% win rate)\n` +
      `- Games: ${ctx.record.total}\n` +
      `- Avg KDA: ${ctx.avgStats.kills}/${ctx.avgStats.deaths}/${ctx.avgStats.assists}\n` +
      `- Avg CS/min: ${ctx.avgStats.csPerMin}\n` +
      `- Avg Gold: ${ctx.avgStats.goldEarned}\n` +
      `- Avg Vision: ${ctx.avgStats.visionScore}`,
  );

  // Comparison to overall averages
  if (ctx.overallAvgStats.games > 0) {
    sections.push(
      `## Comparison to Overall Averages (${ctx.overallAvgStats.games} games)\n` +
        `- Overall KDA: ${ctx.overallAvgStats.kills}/${ctx.overallAvgStats.deaths}/${ctx.overallAvgStats.assists}\n` +
        `- Overall CS/min: ${ctx.overallAvgStats.csPerMin}\n` +
        `- Overall Gold: ${ctx.overallAvgStats.goldEarned}\n` +
        `- Overall Vision: ${ctx.overallAvgStats.visionScore}`,
    );
  }

  // Rune performance
  if (ctx.runeBreakdown.length > 0) {
    const runeLines = ctx.runeBreakdown
      .map((r) => `- ${r.keystoneName}: ${r.wins}W ${r.losses}L (${r.winRate}%, ${r.games} games)`)
      .join("\n");
    sections.push(`## Rune Performance\n${runeLines}`);
  }

  // Recent games summary
  if (ctx.recentGames.length > 0) {
    const gameLines = ctx.recentGames
      .map(
        (g) =>
          `- ${g.result} as ${g.championName} (${g.kills}/${g.deaths}/${g.assists}, ${g.csPerMin} CS/min, ${g.gameDurationMin}min)${g.comment ? ` — Player note: "${g.comment}"` : ""}${g.highlights.length > 0 ? ` — Highlights: ${g.highlights.join("; ")}` : ""}`,
      )
      .join("\n");
    sections.push(`## Recent Games in This Matchup (newest first)\n${gameLines}`);
  }

  // Matchup notes
  if (ctx.matchupNotes) {
    sections.push(`## Player's Own Matchup Notes\n${ctx.matchupNotes}`);
  }

  // Active coaching focus
  if (ctx.activeActionItems.length > 0) {
    const items = ctx.activeActionItems
      .map((a) => `- [${a.status}] ${a.description}${a.topicName ? ` (${a.topicName})` : ""}`)
      .join("\n");
    sections.push(`## Active Coaching Action Items\n${items}`);
  }

  // Goals
  if (ctx.activeGoals.length > 0) {
    const goalLines = ctx.activeGoals.map((g) => `- ${g.title} (${g.status})`).join("\n");
    sections.push(`## Active Goals\n${goalLines}`);
  }

  const prompt =
    sections.join("\n\n") +
    `\n\n---\n\nBased on the data above, provide:\n1. **Patterns** you observe in this matchup (what's working, what isn't)\n2. **Key tips** specifically for this player in this matchup\n3. **Connection to their coaching goals** if relevant\n\nRespond in ${language === "es" ? "Spanish" : "English"}.`;

  return { system: systemPrompt, prompt };
}

// ─── Post-Game Insight ──────────────────────────────────────────────────────

export function buildPostGamePrompt(ctx: PostGameInsightContext, language: string) {
  const systemPrompt = `You are a concise, data-driven League of Legends coach reviewing a specific game. You compare the player's performance to their own averages and provide actionable feedback.

## Formatting rules (STRICT)
- Use ## headings for each section (e.g. ## What Went Well, ## What To Improve, ## Coaching Goals)
- Use bullet points (- ) for each individual point
- Use **bold** for emphasis on key stats or champion names
- Leave a blank line between sections
- Keep your response under 300 words
- Do NOT start with a greeting or "Here's your report" — jump straight into the first heading`;

  const sections: string[] = [];

  // Player identity
  sections.push(
    `## Player\n- Summoner: ${ctx.summonerName}\n- Current rank: ${ctx.currentRank || "Unknown"}`,
  );

  // This game
  sections.push(
    `## This Game: ${ctx.championName} vs ${ctx.matchupChampionName || "Unknown"}\n` +
      `- Result: **${ctx.result}**\n` +
      `- KDA: ${ctx.kills}/${ctx.deaths}/${ctx.assists}\n` +
      `- CS: ${ctx.cs} (${ctx.csPerMin}/min)\n` +
      `- Gold: ${ctx.goldEarned}\n` +
      `- Vision Score: ${ctx.visionScore}\n` +
      `- Duration: ${ctx.gameDurationMin} minutes\n` +
      `- Keystone: ${ctx.runeKeystoneName || "Unknown"}`,
  );

  // Comparison to champion averages
  if (ctx.championAvgStats) {
    const avg = ctx.championAvgStats;
    sections.push(
      `## Your Averages on ${ctx.championName} (${avg.games} games)\n` +
        `- Avg KDA: ${avg.kills}/${avg.deaths}/${avg.assists}\n` +
        `- Avg CS/min: ${avg.csPerMin}\n` +
        `- Avg Gold: ${avg.goldEarned}\n` +
        `- Avg Vision: ${avg.visionScore}`,
    );
  }

  // Player's notes for this game
  if (ctx.comment) {
    sections.push(`## Player's Notes\n"${ctx.comment}"`);
  }

  // Highlights and lowlights
  if (ctx.highlights.length > 0) {
    const hl = ctx.highlights
      .map((h) => `- [${h.type}]${h.topicName ? ` (${h.topicName})` : ""} ${h.text}`)
      .join("\n");
    sections.push(`## Player's Highlights/Lowlights\n${hl}`);
  }

  // Matchup notes
  if (ctx.matchupNotes) {
    sections.push(
      `## Player's Matchup Notes for ${ctx.championName} vs ${ctx.matchupChampionName}\n${ctx.matchupNotes}`,
    );
  }

  // Active coaching focus
  if (ctx.activeActionItems.length > 0) {
    const items = ctx.activeActionItems
      .map((a) => `- [${a.status}] ${a.description}${a.topicName ? ` (${a.topicName})` : ""}`)
      .join("\n");
    sections.push(`## Active Coaching Action Items\n${items}`);
  }

  // Goals
  if (ctx.activeGoals.length > 0) {
    const goalLines = ctx.activeGoals.map((g) => `- ${g.title} (${g.status})`).join("\n");
    sections.push(`## Active Goals\n${goalLines}`);
  }

  const prompt =
    sections.join("\n\n") +
    `\n\n---\n\nBased on the data above, provide:\n1. **What went well** in this game\n2. **What to improve** based on their stats vs averages\n3. **Connection to coaching goals** — did this game show progress or regression on their action items?\n\nRespond in ${language === "es" ? "Spanish" : "English"}.`;

  return { system: systemPrompt, prompt };
}

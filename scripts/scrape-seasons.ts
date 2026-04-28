/**
 * Scrape 2026 season dates from the LoL Wiki.
 *
 * Usage: npx tsx scripts/scrape-seasons.ts
 *
 * Entry point: https://wiki.leagueoflegends.com/en-us/2026_Annual_Cycle
 * Parses season links from the cycle page, then fetches each season page
 * to extract Act I start, Act II start, and End Date from the infobox.
 *
 * Output: src/lib/seasons.json
 */

import * as fs from "node:fs";
import * as path from "node:path";

const BASE_URL = "https://wiki.leagueoflegends.com/en-us";
const CYCLE_URL = `${BASE_URL}/2026_Annual_Cycle`;
const OUTPUT_PATH = path.resolve(__dirname, "../src/lib/seasons.json");

interface SeasonData {
  id: string;
  name: string;
  seasonNumber: number;
  year: number;
  actIStart: string;
  actIIStart: string;
  endDate: string | null;
}

interface SeasonsJson {
  cycleStart: string;
  seasons: SeasonData[];
}

/** Fetch a page's HTML as text. */
async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "levelrise-scraper/1.0 (season-dates)" },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

/**
 * Parse the cycle page to discover season names and wiki links.
 * Looks for list items like: Season 1 — <a href="/en-us/For_Demacia">For Demacia</a>
 */
function parseSeasonLinks(html: string): { name: string; path: string; seasonNumber: number }[] {
  const seasons: { name: string; path: string; seasonNumber: number }[] = [];

  // The wiki uses deeply nested templates for season list items.
  // Strategy: find all <li> items containing "Season N —" and extract the last
  // meaningful <a> link with a title attribute that matches the season name.
  const liRegex = /<li>Season\s+(\d+)\s*(?:—|&mdash;)([\s\S]*?)<\/li>/gi;

  let match;
  while ((match = liRegex.exec(html)) !== null) {
    const seasonNumber = parseInt(match[1], 10);
    const content = match[2];

    // Find all <a> tags with href="/en-us/..." and title="..."
    const linkRegex = /<a\s+href="\/en-us\/([^"]+)"[^>]*title="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
    let lastLink: { path: string; title: string; text: string } | null = null;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(content)) !== null) {
      // Skip icon links (they have empty text or "An icon representing..." alt)
      if (linkMatch[3].trim()) {
        lastLink = { path: linkMatch[1], title: linkMatch[2], text: linkMatch[3].trim() };
      }
    }

    if (!lastLink || lastLink.text === "???" || lastLink.text === "TBD") continue;

    seasons.push({ name: lastLink.text, path: lastLink.path, seasonNumber });
  }

  return seasons;
}

/**
 * Parse a date string like "January 8th, 2026" or "April 29th, 2026" into ISO format.
 */
function parseWikiDate(dateStr: string): string | null {
  // Remove ordinal suffixes (st, nd, rd, th)
  const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/gi, "$1").trim();
  const parsed = new Date(cleaned);
  if (isNaN(parsed.getTime())) return null;

  // Return YYYY-MM-DD
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Extract dates from a season page's infobox.
 * Looks for patterns like:
 *   Act I: January 8th, 2026
 *   Act II: March 4th, 2026
 *   End Date\nApril 29th, 2026
 */
function parseSeasonDates(html: string): {
  actIStart: string | null;
  actIIStart: string | null;
  endDate: string | null;
} {
  // Strip HTML tags for easier regex
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  let actIStart: string | null = null;
  let actIIStart: string | null = null;
  let endDate: string | null = null;

  // Act I: <date>
  const actIMatch = text.match(/Act\s+I:\s*(\w+\s+\d+\w*,?\s*\d{4})/i);
  if (actIMatch) actIStart = parseWikiDate(actIMatch[1]);

  // Act II: <date>
  const actIIMatch = text.match(/Act\s+II:\s*(\w+\s+\d+\w*,?\s*\d{4})/i);
  if (actIIMatch) actIIStart = parseWikiDate(actIIMatch[1]);

  // End Date <date>
  const endMatch = text.match(/End\s+Date\s+(\w+\s+\d+\w*,?\s*\d{4})/i);
  if (endMatch) endDate = parseWikiDate(endMatch[1]);

  return { actIStart, actIIStart, endDate };
}

/**
 * Try to discover the "Next" season from a season page.
 * Looks for: Next <a href="/en-us/SomePage">SeasonName</a>
 */
function parseNextSeasonLink(html: string): { name: string; path: string } | null {
  const nextMatch = html.match(
    /Next\s*(?:<[^>]*>)*\s*<a\s+href="\/en-us\/([^"]+)"[^>]*title="([^"]+)"[^>]*>/i,
  );
  if (
    nextMatch &&
    nextMatch[2] !== "???" &&
    !nextMatch[2].startsWith("Category:") &&
    !nextMatch[2].includes("does not exist") &&
    !nextMatch[1].includes("redlink")
  ) {
    return { name: nextMatch[2], path: nextMatch[1] };
  }
  return null;
}

async function main() {
  console.log("Fetching 2026 Annual Cycle page...");
  const cycleHtml = await fetchPage(CYCLE_URL);

  // Parse cycle start date from the page description
  const cycleStartMatch = cycleHtml.match(/began on (\w+ \d+\w*,? \d{4})/i);
  const cycleStart = cycleStartMatch ? parseWikiDate(cycleStartMatch[1]) : "2026-01-08";

  // Discover seasons from the cycle page
  const seasonLinks = parseSeasonLinks(cycleHtml);
  console.log(`Found ${seasonLinks.length} season(s) on cycle page.`);

  const seasons: SeasonData[] = [];
  const visited = new Set<string>();

  // Process each season + follow "Next" links for auto-discovery
  const queue = seasonLinks.map((s, i) => ({
    ...s,
    seasonNumber: s.seasonNumber || i + 1,
  }));

  while (queue.length > 0) {
    const item = queue.shift()!;
    if (visited.has(item.path)) continue;
    visited.add(item.path);

    const url = `${BASE_URL}/${item.path}`;
    console.log(`Fetching season page: ${item.name} (${url})`);

    try {
      const seasonHtml = await fetchPage(url);
      const dates = parseSeasonDates(seasonHtml);

      if (!dates.actIStart) {
        console.warn(`  ⚠ Could not parse Act I date for ${item.name}, skipping.`);
        continue;
      }

      const seasonData: SeasonData = {
        id: `2026-s${item.seasonNumber}`,
        name: item.name,
        seasonNumber: item.seasonNumber,
        year: 2026,
        actIStart: dates.actIStart,
        actIIStart: dates.actIIStart || dates.actIStart,
        endDate: dates.endDate,
      };

      seasons.push(seasonData);
      console.log(
        `  ✓ ${item.name}: Act I ${dates.actIStart}, Act II ${dates.actIIStart}, End ${dates.endDate ?? "ongoing"}`,
      );

      // Try to discover next season
      const next = parseNextSeasonLink(seasonHtml);
      if (next && !visited.has(next.path)) {
        const nextNumber = item.seasonNumber + 1;
        queue.push({ name: next.name, path: next.path, seasonNumber: nextNumber });
        console.log(`  → Discovered next season: ${next.name}`);
      }
    } catch (err) {
      console.error(`  ✗ Failed to fetch ${item.name}: ${String(err)}`);
    }
  }

  // Sort by season number
  seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

  const output: SeasonsJson = {
    cycleStart: cycleStart || "2026-01-08",
    seasons,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(`\nWrote ${seasons.length} season(s) to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

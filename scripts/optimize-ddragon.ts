#!/usr/bin/env tsx
/**
 * DDragon Asset Optimizer
 *
 * Downloads champion icons, item icons, rune icons, and rank emblems from
 * DDragon / CommunityDragon, converts them to WebP, and resizes them to
 * the exact display sizes used in the app.
 *
 * Run manually or via the `ddragon-assets` GitHub Action when a new patch drops.
 *
 *   npx tsx scripts/optimize-ddragon.ts
 *
 * Requires `sharp` — installed on-the-fly by the GitHub Action runner.
 * For local runs: `npm install -g sharp` or `npx --package=sharp tsx scripts/optimize-ddragon.ts`
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Try to load sharp (available in CI). Falls back to macOS `sips` locally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sharpModule: any = null;

async function loadSharp(): Promise<void> {
  try {
    sharpModule = await import("sharp");
  } catch {
    // sharp not available — will use sips fallback
  }
}

const OUT_DIR = path.resolve(__dirname, "../public/assets/ddragon");
const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json");

// ─── Display sizes used in the app ──────────────────────────────────────────

const CHAMPION_SIZES = [16, 20, 24, 28, 32, 36, 40, 48, 56];
const ITEM_SIZES = [24];
const RUNE_SIZES = [12, 14, 18, 20, 36];
const RANK_EMBLEM_SIZES = [48];

// ─── DDragon API ────────────────────────────────────────────────────────────

async function getLatestVersion(): Promise<string> {
  const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  const versions: string[] = await res.json();
  return versions[0];
}

async function getChampionList(version: string): Promise<string[]> {
  const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`;
  const res = await fetch(url);
  const data = await res.json();
  return Object.keys(data.data); // DDragon champion IDs (e.g. "Aatrox", "MonkeyKing")
}

async function getItemList(version: string): Promise<string[]> {
  const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`;
  const res = await fetch(url);
  const data = await res.json();
  return Object.keys(data.data); // Item IDs (e.g. "1001", "3006")
}

// Keystone rune icon paths (same as KEYSTONE_ICONS in riot-api.ts)
const KEYSTONE_ICONS: Record<string, string> = {
  // Precision
  "8005": "perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png",
  "8008": "perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png",
  "8021": "perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png",
  "8010": "perk-images/Styles/Precision/Conqueror/Conqueror.png",
  // Domination
  "8112": "perk-images/Styles/Domination/Electrocute/Electrocute.png",
  "8124": "perk-images/Styles/Domination/Predator/Predator.png",
  "8128": "perk-images/Styles/Domination/DarkHarvest/DarkHarvest.png",
  "9923": "perk-images/Styles/Domination/HailOfBlades/HailOfBlades.png",
  // Sorcery
  "8214": "perk-images/Styles/Sorcery/SummonAery/SummonAery.png",
  "8229": "perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png",
  "8230": "perk-images/Styles/Sorcery/PhaseRush/PhaseRush.png",
  // Resolve
  "8437": "perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png",
  "8439": "perk-images/Styles/Resolve/VeteranAftershock/VeteranAftershock.png",
  "8465": "perk-images/Styles/Resolve/Guardian/Guardian.png",
  // Inspiration
  "8351": "perk-images/Styles/Inspiration/GlacialAugment/GlacialAugment.png",
  "8360": "perk-images/Styles/Inspiration/UnsealedSpellbook/UnsealedSpellbook.png",
  "8369": "perk-images/Styles/Inspiration/FirstStrike/FirstStrike.png",
};

// Rank tiers for CommunityDragon emblems
const RANK_TIERS = [
  "iron",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "emerald",
  "diamond",
  "master",
  "grandmaster",
  "challenger",
];

// ─── Download + Optimize ────────────────────────────────────────────────────

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function optimizeImage(buffer: Buffer, size: number, outPath: string): Promise<void> {
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (sharpModule) {
    // Use sharp (CI / when installed) — produces WebP
    const fn = sharpModule.default ?? sharpModule;
    await fn(buffer).resize(size, size).webp({ quality: 85 }).toFile(outPath);
  } else if (os.platform() === "darwin") {
    // macOS fallback: write temp PNG, resize with sips, output as PNG
    // (sips WebP write is broken on some macOS versions)
    const pngOutPath = outPath.replace(/\.webp$/, ".png");
    const tmpPng = path.join(
      os.tmpdir(),
      `ddragon-${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
    );
    fs.writeFileSync(tmpPng, buffer);
    try {
      execSync(`sips -z ${size} ${size} "${tmpPng}" --out "${pngOutPath}"`, {
        stdio: "pipe",
      });
    } finally {
      fs.unlinkSync(tmpPng);
    }
  } else {
    throw new Error("Neither sharp nor macOS sips available. Install sharp: npm install sharp");
  }
}

interface AssetJob {
  name: string;
  url: string;
  type: string;
  sizes: number[];
}

async function processAsset(job: AssetJob): Promise<void> {
  const buffer = await downloadBuffer(job.url);
  for (const size of job.sizes) {
    const outPath = path.join(OUT_DIR, job.type, String(size), `${job.name}.webp`);
    await optimizeImage(buffer, size, outPath);
  }
}

// Process assets with concurrency limit to avoid overwhelming the network
async function processAllAssets(jobs: AssetJob[], concurrency = 20): Promise<void> {
  let index = 0;
  const total = jobs.length;
  let completed = 0;

  async function worker(): Promise<void> {
    while (index < total) {
      const current = index++;
      const job = jobs[current];
      try {
        await processAsset(job);
        completed++;
        if (completed % 50 === 0 || completed === total) {
          console.log(`  [${completed}/${total}] processed`);
        }
      } catch (err) {
        console.error(`  ✗ Failed: ${job.type}/${job.name} — ${String(err)}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("DDragon Asset Optimizer\n");

  await loadSharp();
  if (sharpModule) {
    console.log("Using sharp for image processing");
  } else if (os.platform() === "darwin") {
    console.log("Using macOS sips for image processing (sharp not available)");
  } else {
    console.error("Error: Neither sharp nor macOS sips available.");
    process.exit(1);
  }

  // Check if we should skip (version unchanged)
  const version = await getLatestVersion();
  console.log(`Latest DDragon version: ${version}`);

  if (fs.existsSync(MANIFEST_PATH)) {
    const existing = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    if (existing.version === version && !process.argv.includes("--force")) {
      console.log(`Assets already up to date (${version}). Use --force to re-generate.`);
      process.exit(0);
    }
  }

  // Clean output directory
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const jobs: AssetJob[] = [];

  // 1. Champions
  console.log("\nFetching champion list...");
  const champions = await getChampionList(version);
  console.log(`  ${champions.length} champions`);
  for (const name of champions) {
    jobs.push({
      name,
      url: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${name}.png`,
      type: "champion",
      sizes: CHAMPION_SIZES,
    });
  }

  // 2. Items
  console.log("Fetching item list...");
  const items = await getItemList(version);
  console.log(`  ${items.length} items`);
  for (const id of items) {
    jobs.push({
      name: id,
      url: `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`,
      type: "item",
      sizes: ITEM_SIZES,
    });
  }

  // 3. Runes (keystones only)
  console.log("Processing rune keystones...");
  for (const [id, iconPath] of Object.entries(KEYSTONE_ICONS)) {
    jobs.push({
      name: id,
      url: `https://ddragon.leagueoflegends.com/cdn/img/${iconPath}`,
      type: "rune",
      sizes: RUNE_SIZES,
    });
  }

  // 4. Rank emblems
  console.log("Processing rank emblems...");
  for (const tier of RANK_TIERS) {
    jobs.push({
      name: tier,
      url: `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${tier}.png`,
      type: "rank-emblem",
      sizes: RANK_EMBLEM_SIZES,
    });
  }

  console.log(`\nProcessing ${jobs.length} assets...`);
  await processAllAssets(jobs);

  // Write manifest
  const manifest = {
    version,
    generatedAt: new Date().toISOString(),
    counts: {
      champions: champions.length,
      items: items.length,
      runes: Object.keys(KEYSTONE_ICONS).length,
      rankEmblems: RANK_TIERS.length,
    },
    sizes: {
      champion: CHAMPION_SIZES,
      item: ITEM_SIZES,
      rune: RUNE_SIZES,
      rankEmblem: RANK_EMBLEM_SIZES,
    },
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\n✓ Done! Assets written to public/assets/ddragon/`);
  console.log(`  Version: ${version}`);
  console.log(
    `  Champions: ${champions.length} × ${CHAMPION_SIZES.length} sizes = ${champions.length * CHAMPION_SIZES.length} files`,
  );
  console.log(
    `  Items: ${items.length} × ${ITEM_SIZES.length} sizes = ${items.length * ITEM_SIZES.length} files`,
  );
  console.log(
    `  Runes: ${Object.keys(KEYSTONE_ICONS).length} × ${RUNE_SIZES.length} sizes = ${Object.keys(KEYSTONE_ICONS).length * RUNE_SIZES.length} files`,
  );
  console.log(
    `  Rank emblems: ${RANK_TIERS.length} × ${RANK_EMBLEM_SIZES.length} sizes = ${RANK_TIERS.length * RANK_EMBLEM_SIZES.length} files`,
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

import type { FullConfig } from "@playwright/test";

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Global setup for smoke tests:
 * 1. Ensures the data/ directory exists
 * 2. Removes any stale local SQLite database
 * 3. Runs Drizzle migrations to create all tables
 * 4. Seeds the database with demo data
 *
 * The Next.js build is handled externally:
 * - Locally: Playwright's webServer.command builds + starts the app
 * - CI: the workflow builds before running tests
 *
 * After this runs, Playwright's webServer starts the production server,
 * and the "setup" project performs demo login to save auth state.
 */
export default async function globalSetup(_config: FullConfig) {
  const projectRoot = path.resolve(__dirname, "../../..");
  const dbEnv = {
    ...process.env,
    TURSO_DATABASE_URL: "file:./data/levelrise.db",
    TURSO_AUTH_TOKEN: "",
  };

  // ─── 1. Ensure data directory + remove stale DB ──────────────────────────
  const dataDir = path.join(projectRoot, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "levelrise.db");
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = dbPath + suffix;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  // ─── 2. Run migrations (creates all tables) ─────────────────────────────
  console.log("[smoke] Running migrations...");
  execSync("npx tsx scripts/migrate.ts", {
    cwd: projectRoot,
    stdio: "inherit",
    env: dbEnv,
  });

  // ─── 3. Seed the database ────────────────────────────────────────────────
  console.log("[smoke] Seeding local database...");
  execSync("npm run db:seed", {
    cwd: projectRoot,
    stdio: "inherit",
    env: dbEnv,
  });

  // ─── 4. Seed demo user (public demo) ────────────────────────────────────
  console.log("[smoke] Seeding demo user...");
  execSync("npx tsx scripts/seed-demo.ts --execute", {
    cwd: projectRoot,
    stdio: "inherit",
    env: dbEnv,
  });

  // Ensure the .auth directory exists for the setup project
  const authDir = path.join(__dirname, ".auth");
  fs.mkdirSync(authDir, { recursive: true });

  console.log("[smoke] Global setup complete. Server will be started by Playwright.");
}

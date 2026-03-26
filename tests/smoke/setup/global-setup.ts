import { type FullConfig } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

/**
 * Global setup for smoke tests:
 * 1. Ensures the data/ directory exists
 * 2. Removes any stale local SQLite database
 * 3. Seeds the database with demo data
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

  // ─── 1. Ensure data directory + remove stale DB ──────────────────────────
  const dataDir = path.join(projectRoot, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "lol-tracker.db");
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = dbPath + suffix;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  // ─── 2. Seed the database ────────────────────────────────────────────────
  console.log("[smoke] Seeding local database...");
  execSync("npm run db:seed", {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      TURSO_DATABASE_URL: "file:./data/lol-tracker.db",
      TURSO_AUTH_TOKEN: "",
    },
  });

  // Ensure the .auth directory exists for the setup project
  const authDir = path.join(__dirname, ".auth");
  fs.mkdirSync(authDir, { recursive: true });

  console.log("[smoke] Global setup complete. Server will be started by Playwright.");
}

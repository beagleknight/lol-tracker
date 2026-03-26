import { type FullConfig } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

/**
 * Global setup for smoke tests:
 * 1. Removes any stale local SQLite database
 * 2. Seeds the database with demo data
 * 3. Builds the Next.js app in demo mode
 *
 * After this runs, Playwright's webServer config starts the production server,
 * and the "setup" project performs demo login to save auth state.
 */
export default async function globalSetup(_config: FullConfig) {
  const projectRoot = path.resolve(__dirname, "../../..");

  // ─── 1. Remove stale DB so seed creates tables with latest schema ────────
  const dbPath = path.join(projectRoot, "data", "lol-tracker.db");
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

  // ─── 3. Build the app ────────────────────────────────────────────────────
  console.log("[smoke] Building Next.js app...");
  execSync("npm run build", {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_DEMO_MODE: "true",
      AUTH_SECRET: "smoke-test-secret-at-least-32-characters",
      TURSO_DATABASE_URL: "file:./data/lol-tracker.db",
      TURSO_AUTH_TOKEN: "",
    },
  });

  // Ensure the .auth directory exists for the setup project
  const authDir = path.join(__dirname, ".auth");
  fs.mkdirSync(authDir, { recursive: true });

  console.log("[smoke] Global setup complete. Server will be started by Playwright.");
}

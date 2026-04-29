import { defineConfig } from "@playwright/test";

const isCI = !!process.env.CI;

/**
 * Use a non-standard port to avoid conflicts with other local services
 * (e.g. Ascent GEP uses port 3000 and respawns automatically).
 */
const TEST_PORT = 3099;

/**
 * Test configuration for smoke and E2E tests.
 *
 * Starts the Next.js production server in demo mode and verifies
 * that all routes respond correctly. Uses a local SQLite database
 * with seeded demo data (see tests/smoke/setup/global-setup.ts).
 *
 * Convention: Playwright smoke/E2E tests use *.spec.ts.
 * Future Vitest unit tests will use *.test.ts (colocated in src/).
 */
export default defineConfig({
  /* Seed the DB before all tests */
  globalSetup: "tests/smoke/setup/global-setup.ts",

  /* Start the production server for tests.
   * - Locally: build + start on TEST_PORT (avoids port 3000 conflicts)
   * - CI: just start (build is a separate workflow step for reliability) */
  webServer: {
    command: isCI
      ? `npm run start -- --port ${TEST_PORT}`
      : `npm run build && npm run start -- --port ${TEST_PORT}`,
    port: TEST_PORT,
    timeout: 180_000,
    reuseExistingServer: !isCI,
    env: {
      NEXT_PUBLIC_DEMO_MODE: "true",
      AUTH_SECRET: "smoke-test-secret-at-least-32-characters",
      AUTH_TRUST_HOST: "true",
      TURSO_DATABASE_URL: "file:./data/levelrise.db",
      TURSO_AUTH_TOKEN: "",
      NEXT_PUBLIC_CANNY_BOARD_TOKEN: "test-board-token",
    },
  },

  projects: [
    /* ── Setup: logs in and saves auth state ─────────────────────── */
    {
      name: "setup",
      testDir: "tests/smoke",
      testMatch: "**/*.setup.ts",
    },

    /* ── Smoke tests: fast, parallel, reuse saved auth state ─────── */
    {
      name: "smoke",
      testDir: "tests/smoke",
      testMatch: "**/*.spec.ts",
      dependencies: ["setup"],
      fullyParallel: true,
      retries: 0,
      timeout: 30_000,
      expect: { timeout: 10_000 },
      use: {
        browserName: "chromium",
        storageState: "tests/smoke/setup/.auth/demo-user.json",
      },
    },

    /* ── E2E tests: serial, fresh DB per file, reuse saved auth ──── */
    {
      name: "e2e",
      testDir: "tests/e2e",
      testMatch: "**/*.spec.ts",
      dependencies: ["setup"],
      fullyParallel: false,
      /* Single worker — spec files share a SQLite DB and reseed in
         beforeAll, so concurrent workers would cause SQLITE_BUSY. */
      workers: 1,
      retries: 0,
      timeout: 60_000,
      expect: { timeout: 15_000 },
      use: {
        browserName: "chromium",
        storageState: "tests/smoke/setup/.auth/demo-user.json",
      },
    },
  ],
});

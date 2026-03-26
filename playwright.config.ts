import { defineConfig } from "@playwright/test";

/**
 * Smoke test configuration.
 *
 * Starts the Next.js production server in demo mode and verifies
 * that all routes respond correctly. Uses a local SQLite database
 * with seeded demo data (see tests/smoke/setup/global-setup.ts).
 *
 * Convention: Playwright smoke/E2E tests use *.spec.ts.
 * Future Vitest unit tests will use *.test.ts (colocated in src/).
 */
export default defineConfig({
  testDir: "tests/smoke",

  /* Fail fast — these are smoke tests, not a full E2E suite */
  retries: 0,

  /* Run tests in parallel within each file */
  fullyParallel: true,

  projects: [
    /* Setup project: logs in and saves auth state */
    {
      name: "setup",
      testMatch: "**/*.setup.ts",
    },
    /* Smoke tests: reuse saved auth state */
    {
      name: "smoke",
      testMatch: "**/*.spec.ts",
      dependencies: ["setup"],
      use: {
        browserName: "chromium",
        storageState: "tests/smoke/setup/.auth/demo-user.json",
      },
    },
  ],

  /* Seed the DB and build the app before all tests */
  globalSetup: "tests/smoke/setup/global-setup.ts",

  /* Start the production server for tests */
  webServer: {
    command: "npm run start",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_DEMO_MODE: "true",
      AUTH_SECRET: "smoke-test-secret-at-least-32-characters",
      TURSO_DATABASE_URL: "file:./data/lol-tracker.db",
      TURSO_AUTH_TOKEN: "",
    },
  },

  /* Reasonable timeout for smoke tests */
  timeout: 30_000,
  expect: { timeout: 10_000 },
});

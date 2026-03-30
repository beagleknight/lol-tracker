import { test, expect } from "@playwright/test";

/**
 * Smoke tests for all authenticated routes.
 *
 * These tests use the auth state saved during global setup (logged in
 * as DemoPlayer). Each test simply navigates to a route and verifies
 * the page loads successfully (200 status, no error boundary).
 *
 * For dynamic routes (/matches/[id], /coaching/[id]), we use known IDs
 * from the deterministic seed data.
 */

// Known IDs from seed.ts (deterministic)
const SEED_MATCH_ID = "EUW1_7000000010";
const SEED_COACHING_SESSION_ID = "1"; // first coaching session (completed)
const SEED_COACHING_SESSION_SCHEDULED_ID = "3"; // scheduled session

const AUTHENTICATED_ROUTES = [
  { path: "/dashboard", name: "Dashboard" },
  { path: "/matches", name: "Matches list" },
  { path: `/matches/${SEED_MATCH_ID}`, name: "Match detail" },
  { path: "/analytics", name: "Analytics" },
  { path: "/coaching", name: "Coaching sessions" },
  { path: "/coaching/new", name: "New coaching session" },
  {
    path: `/coaching/${SEED_COACHING_SESSION_ID}`,
    name: "Coaching session detail",
  },
  {
    path: `/coaching/${SEED_COACHING_SESSION_SCHEDULED_ID}/complete`,
    name: "Complete coaching session",
  },
  { path: "/coaching/action-items", name: "Coaching action items" },
  { path: "/duo", name: "Duo analytics" },
  { path: "/scout", name: "Matchup scout" },
  { path: "/review", name: "Post-game review" },
  { path: "/changelog", name: "Changelog" },
  { path: "/settings", name: "Settings" },
];

for (const route of AUTHENTICATED_ROUTES) {
  test(`${route.path} — ${route.name} loads`, async ({ page }) => {
    const response = await page.goto(route.path);
    expect(response?.status()).toBe(200);

    // Verify we didn't get redirected to login (auth failure)
    expect(page.url()).not.toContain("/login");

    // Verify no error boundary is showing
    await expect(page.getByRole("heading", { name: /something went wrong/i })).not.toBeVisible();
  });
}

import { test, expect } from "@playwright/test";

/**
 * Data integrity smoke tests.
 *
 * These verify that seeded data actually renders on key pages — not just
 * that pages return HTTP 200. This catches bugs where migrations create
 * tables but fail to migrate existing data (e.g. migration 0022 incident).
 *
 * Uses the same pre-authenticated session as other smoke tests (DemoPlayer).
 */

test.describe("Data integrity", () => {
  test("Dashboard shows recent matches", async ({ page }) => {
    await page.goto("/dashboard");

    // At least one match card link should be visible
    const matchLinks = page.locator('a[href^="/matches/EUW1_"]');
    await expect(matchLinks.first()).toBeVisible();
    expect(await matchLinks.count()).toBeGreaterThanOrEqual(1);
  });

  test("Matches page shows match cards with stats", async ({ page }) => {
    await page.goto("/matches");

    // Summary line should show game count (e.g. "47 games · 26W 21L · 55% WR")
    // Use .first() because the page may have a desktop and mobile version
    await expect(page.getByText(/\d+ games/).first()).toBeVisible();

    // At least one match card link should exist
    const matchLinks = page.locator('a[href^="/matches/EUW1_"]');
    await expect(matchLinks.first()).toBeVisible();
    expect(await matchLinks.count()).toBeGreaterThanOrEqual(1);
  });

  test("Settings page shows linked Riot account", async ({ page }) => {
    await page.goto("/settings");

    // A Riot ID with # separator should be visible (e.g. "DemoPlayer#EUW")
    // Wait for it to appear as account data loads asynchronously
    await expect(page.getByText(/#/).first()).toBeVisible({ timeout: 15_000 });
  });

  test("Analytics page shows game data", async ({ page }) => {
    await page.goto("/analytics");

    // "N games analyzed" text should be visible
    // Use .first() because the page may have desktop and mobile versions
    await expect(page.getByText(/\d+ games analyzed/).first()).toBeVisible();

    // At least one chart SVG should render
    const charts = page.locator(".recharts-surface");
    await expect(charts.first()).toBeVisible();
    expect(await charts.count()).toBeGreaterThanOrEqual(1);
  });

  test("CSV export contains match data", async ({ request }) => {
    const response = await request.get("/api/export/matches");
    expect(response.status()).toBe(200);

    const body = await response.text();
    const lines = body.trim().split("\n");
    // Header + at least 1 data row
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});

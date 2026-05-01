import { test, expect } from "@playwright/test";

import { reseedDatabase } from "./helpers/reseed";

/**
 * E2E: Analytics page
 *
 * Verifies the analytics page loads with charts, champion stats table,
 * and rune keystones table from seeded match data.
 */

test.beforeAll(async () => {
  await reseedDatabase();
});

test.describe("Analytics", () => {
  test("page loads with heading and game count", async ({ page }) => {
    await page.goto("/analytics");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Page title
    await expect(main.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });

    // Should show "X games analyzed" text
    await expect(main.getByText(/games analyzed/i).first()).toBeVisible();
  });

  test("champion stats table is visible", async ({ page }) => {
    await page.goto("/analytics");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Champion stats section
    await expect(main.getByText(/champion stats/i).first()).toBeVisible({ timeout: 10_000 });

    // Table should have rows with champion data (win rate badges)
    await expect(main.getByText(/%/).first()).toBeVisible();
  });

  test("rune keystones table is visible", async ({ page }) => {
    await page.goto("/analytics");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Rune keystones section
    await expect(main.getByText(/rune keystones/i).first()).toBeVisible({ timeout: 15_000 });
  });
});

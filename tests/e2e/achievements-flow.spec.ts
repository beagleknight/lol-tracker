import { test, expect } from "@playwright/test";

import { reseedDatabase } from "./helpers/reseed";

/**
 * E2E: Achievements page
 *
 * Verifies the achievements page loads with summary stats,
 * category tabs, and achievement cards from seeded data.
 */

test.beforeAll(async () => {
  await reseedDatabase();
});

test.describe("Achievements", () => {
  test("page loads with summary and achievement cards", async ({ page }) => {
    await page.goto("/achievements");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Page title
    await expect(main.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });

    // Summary badge showing "X of Y" unlocked
    await expect(main.getByText(/\d+.*of.*\d+/i).first()).toBeVisible();
  });

  test("category tabs are visible", async ({ page }) => {
    await page.goto("/achievements");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Should have tab list with category tabs
    await expect(page.getByRole("tablist").first()).toBeVisible({ timeout: 10_000 });

    // At least the "All" tab should exist
    await expect(page.getByRole("tab").first()).toBeVisible();
  });

  test("achievement cards display tier badges or descriptions", async ({ page }) => {
    await page.goto("/achievements");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Seed data has 28 pre-unlocked achievements with tier badges (Iron, Bronze, etc.)
    await expect(main.getByText(/iron|bronze|silver|gold/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

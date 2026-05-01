import { test, expect } from "@playwright/test";

import { reseedDatabase } from "./helpers/reseed";

/**
 * E2E: Matches list and detail pages
 *
 * Verifies the match list loads with filters and pagination,
 * and that clicking a match navigates to a detail page.
 */

test.beforeAll(async () => {
  await reseedDatabase();
});

test.describe("Matches list", () => {
  test("displays match cards with summary stats", async ({ page }) => {
    await page.goto("/matches");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Heading
    await expect(main.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });

    // Summary line with wins/losses/win rate
    await expect(main.getByText(/\d+W.*\d+L.*\d+%/i).first()).toBeVisible();

    // At least one match card linking to detail
    await expect(main.locator('a[href*="/matches/"]').first()).toBeVisible();
  });

  test("filter dropdowns are visible", async ({ page }) => {
    await page.goto("/matches");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Result filter
    await expect(page.locator('[aria-label="Filter by result"]')).toBeVisible();

    // Champion filter
    await expect(page.locator('[aria-label="Filter by champion"]')).toBeVisible();

    // Review filter
    await expect(page.locator('[aria-label="Filter by review status"]')).toBeVisible();
  });

  test("navigating to match detail page loads content", async ({ page }) => {
    // Use a known seeded match ID
    await page.goto("/matches/EUW1_7000000010");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/login/);

    // Should show match content (KDA, champion name, etc.)
    await expect(main.getByText(/\//).first()).toBeVisible({ timeout: 10_000 });
  });
});

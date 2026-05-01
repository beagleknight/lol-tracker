import { test, expect } from "@playwright/test";

import { reseedDatabase } from "./helpers/reseed";

/**
 * E2E: Duo page
 *
 * Verifies the duo page loads with partner stats, KDA cards,
 * champion synergy, and recent games. The demo user has a duo
 * partner configured with 26 duo games in the seed data.
 */

test.beforeAll(async () => {
  await reseedDatabase();
});

test.describe("Duo", () => {
  test("page loads with duo stats cards", async ({ page }) => {
    await page.goto("/duo");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Page title
    await expect(main.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });

    // Duo win rate card — should show a percentage
    await expect(main.getByText(/%/).first()).toBeVisible();
  });

  test("shows games together count", async ({ page }) => {
    await page.goto("/duo");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Should show games together label and a number
    await expect(main.getByText(/games together/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("shows champion synergy section", async ({ page }) => {
    await page.goto("/duo");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Champion synergy card
    await expect(main.getByText(/synergy/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("shows recent duo games", async ({ page }) => {
    await page.goto("/duo");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Recent duo games section with match links
    await expect(main.getByText(/recent duo games/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(main.locator('a[href*="/matches/"]').first()).toBeVisible();
  });
});

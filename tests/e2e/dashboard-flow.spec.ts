import { test, expect } from "@playwright/test";

import { reseedDatabase } from "./helpers/reseed";

/**
 * E2E: Dashboard page
 *
 * Verifies the dashboard loads with rank info, stat cards,
 * recent matches, and widget sections.
 */

test.beforeAll(async () => {
  await reseedDatabase();
});

test.describe("Dashboard", () => {
  test("displays rank, win rate, streak, and KDA cards", async ({ page }) => {
    await page.goto("/dashboard");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Rank card should show a tier (seed data has Gold)
    await expect(main.getByText(/Gold/i).first()).toBeVisible({ timeout: 10_000 });

    // Win rate card — look for percentage
    await expect(main.getByText(/%/).first()).toBeVisible();

    // KDA card — look for slash-separated numbers (e.g. "5.2/3.1/7.0")
    await expect(main.getByText(/\d+\.\d+\/\d+\.\d+\/\d+\.\d+/).first()).toBeVisible();
  });

  test("shows recent matches section with match cards", async ({ page }) => {
    await page.goto("/dashboard");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // "Recent games" heading or similar
    await expect(main.getByText(/recent games/i).first()).toBeVisible({ timeout: 10_000 });

    // Match cards link to /matches/
    await expect(main.locator('a[href*="/matches/"]').first()).toBeVisible();
  });

  test("shows coaching widget", async ({ page }) => {
    await page.goto("/dashboard");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Coaching widget should be visible (seed data has coaching sessions)
    await expect(main.getByText(/coaching/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("shows challenges widget", async ({ page }) => {
    await page.goto("/dashboard");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Challenges widget — seed data has active challenges
    await expect(main.getByText(/challenges/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("shows action items section", async ({ page }) => {
    await page.goto("/dashboard");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Action items card (seed data has active action items)
    await expect(main.getByText(/action items/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

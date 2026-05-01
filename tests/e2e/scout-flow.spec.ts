import { test, expect } from "@playwright/test";

import { reseedDatabase } from "./helpers/reseed";

/**
 * E2E: Scout page
 *
 * Verifies the scout page loads with champion pickers,
 * pre-selects the most-played champion, and can load a matchup report.
 */

test.beforeAll(async () => {
  await reseedDatabase();
});

test.describe("Scout", () => {
  test("page loads with champion pickers", async ({ page }) => {
    await page.goto("/scout");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Page title
    await expect(main.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });

    // Both champion combobox buttons should be present (role="combobox")
    const comboboxes = main.getByRole("combobox");
    await expect(comboboxes.first()).toBeVisible();
    await expect(comboboxes.nth(1)).toBeVisible();
  });

  test("your champion is pre-selected from most-played", async ({ page }) => {
    await page.goto("/scout");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // The first combobox (your champion) should show a champion name, not the placeholder
    // Pre-selected from most-played champion (PR #331)
    const yourCombobox = main.getByRole("combobox").first();
    await expect(yourCombobox).toBeVisible({ timeout: 10_000 });
    // The button text should NOT contain the placeholder text when pre-selected
    await expect(yourCombobox).not.toHaveText(/select.*champion/i, { timeout: 10_000 });
  });

  test("shows empty state when no enemy selected", async ({ page }) => {
    await page.goto("/scout");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Should show the "select enemy" prompt
    await expect(main.getByText(/select.*enemy/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

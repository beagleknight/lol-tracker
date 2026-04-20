import { test, expect } from "@playwright/test";

import { reseedDatabase } from "./helpers/reseed";

/**
 * E2E: Challenge lifecycle
 *
 * Covers: viewing seeded challenges, retiring an active challenge, creating a new
 * by-date challenge, verifying dashboard widget, and deleting a past challenge.
 * Tests run serially and share state — order matters.
 *
 * Seed data: 1 completed by-date ("Reach Gold IV"), 1 active by-date ("Reach Platinum IV"),
 * 2 active by-games. Demo user is Gold III 62 LP.
 */

test.beforeAll(async () => {
  await reseedDatabase();
});

test.describe("Challenges flow", () => {
  test("challenges page shows seeded challenges", async ({ page }) => {
    await page.goto("/challenges");
    const main = page.getByRole("main");

    // Active challenge: "Reach Platinum IV" with Active badge
    await expect(main.getByText("Reach Platinum IV")).toBeVisible();
    await expect(main.locator('[data-slot="badge"]:has-text("Active")').first()).toBeVisible();

    // Progress bar should be visible
    await expect(main.getByText("Progress").first()).toBeVisible();

    // Past challenges section should show the completed challenge
    await expect(main.getByText("Past challenges")).toBeVisible();
    await expect(main.getByText("Reach Gold IV")).toBeVisible();
    await expect(main.locator('[data-slot="badge"]:has-text("Completed")')).toBeVisible();
  });

  test("dashboard shows active challenge widget", async ({ page }) => {
    await page.goto("/dashboard");
    const main = page.getByRole("main");

    // The challenge widget should show the active challenge title
    await expect(main.getByText("Reach Platinum IV").first()).toBeVisible();
  });

  test("retire an active by-date challenge", async ({ page }) => {
    await page.goto("/challenges");
    const main = page.getByRole("main");

    // Set up dialog handler to accept the confirm prompt
    page.on("dialog", (dialog) => dialog.accept());

    // Find the card containing "Reach Platinum IV" and click its Retire button.
    // The card structure is: <div data-slot="card"> > <div data-slot="card-header"> > ... title
    // Use a card-scoped locator to find the right Retire button.
    const platCard = main.locator('[data-slot="card"]', { hasText: "Reach Platinum IV" });
    await platCard.getByRole("button", { name: "Retire" }).click();

    // Verify the challenge moved to past challenges with "Retired" badge
    await expect(main.locator('[data-slot="badge"]:has-text("Retired")').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("dashboard shows 'no active goal' after retiring by-date challenge", async ({ page }) => {
    await page.goto("/dashboard");
    const main = page.getByRole("main");

    // After retiring the only by-date challenge, the dashboard widget shows the empty state.
    // Dashboard still uses old "goal" terminology for the widget.
    await expect(main.getByText("No active goal set.").first()).toBeVisible({ timeout: 15_000 });
    await expect(main.getByRole("link", { name: "Set a goal" }).first()).toBeVisible();
  });

  test("create a new by-date challenge", async ({ page }) => {
    await page.goto("/challenges/new");
    const main = page.getByRole("main");

    // Should be on the "Rank target" tab by default
    await expect(main.getByText("Current rank").first()).toBeVisible();

    // Select tier: Platinum
    await main.getByRole("combobox").first().click();
    await page.locator('[data-slot="select-item"]').filter({ hasText: "Platinum" }).click();

    // Select division: III
    const divisionCombobox = main.getByRole("combobox").nth(1);
    await divisionCombobox.click();
    await page.locator('[data-slot="select-item"]').filter({ hasText: /^III$/ }).click();

    // Challenge preview should show
    await expect(main.getByText("Reach Platinum III").first()).toBeVisible();

    // Submit the form
    await main.getByRole("button", { name: "Create challenge" }).click();

    // Should get success toast and redirect to /challenges
    await expect(page.getByText("Challenge created!")).toBeVisible({ timeout: 15_000 });

    try {
      await page.waitForURL("/challenges", { timeout: 10_000 });
    } catch {
      await page.goto("/challenges");
    }

    // Verify the new challenge is active on the challenges page
    const challengesMain = page.getByRole("main");
    await expect(challengesMain.getByText("Reach Platinum III").first()).toBeVisible();
    await expect(
      challengesMain.locator('[data-slot="badge"]:has-text("Active")').first(),
    ).toBeVisible();
  });

  test("delete a past challenge", async ({ page }) => {
    await page.goto("/challenges");
    const main = page.getByRole("main");

    // Set up dialog handler to accept the confirm prompt
    page.on("dialog", (dialog) => dialog.accept());

    // Find the "Reach Gold IV" past challenge card and its delete button
    const completedCard = main.locator('[data-slot="card"]', { hasText: "Reach Gold IV" });
    await completedCard.getByRole("button", { name: "Delete challenge" }).click();

    // Verify "Reach Gold IV" is gone after deletion
    await expect(main.getByText("Reach Gold IV")).not.toBeVisible({
      timeout: 10_000,
    });

    // "Reach Platinum IV" (retired from earlier test) should still be there
    await expect(page.getByRole("main").getByText("Reach Platinum IV")).toBeVisible();
  });
});

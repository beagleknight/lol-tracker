import { test, expect } from "@playwright/test";

import { reseedDatabase } from "./helpers/reseed";

/**
 * E2E: Goal setting lifecycle
 *
 * Covers: viewing seeded goals, retiring the active goal, creating a new goal,
 * verifying dashboard widget, and deleting a past goal.
 * Tests run serially and share state — order matters.
 *
 * Seed data: 1 achieved goal ("Reach Gold IV") + 1 active goal ("Reach Platinum IV").
 * Demo user is Gold III 62 LP.
 */

test.beforeAll(async () => {
  await reseedDatabase();
});

test.describe("Goals flow", () => {
  test("goals page shows seeded goals", async ({ page }) => {
    await page.goto("/goals");
    const main = page.getByRole("main");

    // Active goal: "Reach Platinum IV" with Active badge
    await expect(main.getByText("Reach Platinum IV")).toBeVisible();
    await expect(main.locator('[data-slot="badge"]:has-text("Active")')).toBeVisible();

    // Progress bar should be visible (use .first() since "progress" appears in subtitle too)
    await expect(main.getByText("Progress").first()).toBeVisible();

    // Past goals section should show the achieved goal
    await expect(main.getByText("Past Goals")).toBeVisible();
    await expect(main.getByText("Reach Gold IV")).toBeVisible();
    await expect(main.locator('[data-slot="badge"]:has-text("Achieved")')).toBeVisible();

    // Should NOT show "New Goal" button since there's an active goal
    await expect(main.getByRole("link", { name: "New Goal" })).not.toBeVisible();
  });

  test("dashboard shows active goal widget", async ({ page }) => {
    await page.goto("/dashboard");
    const main = page.getByRole("main");

    // The goal widget should show the active goal title
    await expect(main.getByText("Reach Platinum IV").first()).toBeVisible();
  });

  test("retire the active goal", async ({ page }) => {
    await page.goto("/goals");
    const main = page.getByRole("main");

    // Set up dialog handler to accept the confirm prompt
    page.on("dialog", (dialog) => dialog.accept());

    // Click the "Retire" button
    await main.getByRole("button", { name: "Retire" }).click();

    // Verify the goal moved to past goals with "Retired" badge
    await expect(main.locator('[data-slot="badge"]:has-text("Retired")').first()).toBeVisible({
      timeout: 10_000,
    });

    // "New Goal" button should appear now
    await expect(page.getByRole("main").getByRole("link", { name: "New Goal" })).toBeVisible();

    // Active badge should be gone
    await expect(
      page.getByRole("main").locator('[data-slot="badge"]:has-text("Active")'),
    ).not.toBeVisible();
  });

  test("dashboard shows 'no active goal' after retiring", async ({ page }) => {
    await page.goto("/dashboard");
    const main = page.getByRole("main");

    // Should show "No active goal set." and a "Set a goal" link
    await expect(main.getByText("No active goal set.").first()).toBeVisible();
    await expect(main.getByRole("link", { name: "Set a goal" }).first()).toBeVisible();
  });

  test("create a new goal", async ({ page }) => {
    await page.goto("/goals/new");
    const main = page.getByRole("main");

    // Current rank context should be shown
    await expect(main.getByText("Current rank").first()).toBeVisible();

    // Select tier: Platinum
    await main.getByRole("combobox").first().click();
    await page.locator('[data-slot="select-item"]').filter({ hasText: "Platinum" }).click();

    // Select division: III
    // After selecting tier, a second combobox for division appears
    const divisionCombobox = main.getByRole("combobox").nth(1);
    await divisionCombobox.click();
    await page.locator('[data-slot="select-item"]').filter({ hasText: /^III$/ }).click();

    // Goal preview should show
    await expect(main.getByText("Reach Platinum III").first()).toBeVisible();

    // Submit the form
    await main.getByRole("button", { name: "Create Goal" }).click();

    // Should get success toast and redirect to /goals
    await expect(page.getByText("Goal created!")).toBeVisible({ timeout: 15_000 });

    try {
      await page.waitForURL("/goals", { timeout: 10_000 });
    } catch {
      await page.goto("/goals");
    }

    // Verify the new goal is active on the goals page
    const goalsMain = page.getByRole("main");
    await expect(goalsMain.getByText("Reach Platinum III").first()).toBeVisible();
    await expect(goalsMain.locator('[data-slot="badge"]:has-text("Active")')).toBeVisible();
  });

  test("delete a past goal", async ({ page }) => {
    await page.goto("/goals");
    const main = page.getByRole("main");

    // Set up dialog handler to accept the confirm prompt
    page.on("dialog", (dialog) => dialog.accept());

    // The past goals section should have "Reach Gold IV" (achieved) and
    // "Reach Platinum IV" (retired from earlier test).
    // Delete buttons are trash icons on past goal cards.
    // Find the "Reach Gold IV" row and its delete button.
    const achievedGoalRow = main.getByText("Reach Gold IV").locator("../..");
    const deleteButton = achievedGoalRow.locator("button").last();
    await deleteButton.click();

    // Verify "Reach Gold IV" is gone after deletion
    await expect(main.getByText("Reach Gold IV")).not.toBeVisible({
      timeout: 10_000,
    });

    // "Reach Platinum IV" (retired) should still be there
    await expect(page.getByRole("main").getByText("Reach Platinum IV")).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";

import { reseedDatabase } from "./helpers/reseed";

/**
 * E2E: Review lifecycle (2-tab system)
 *
 * Covers: viewing pending matches, clicking topic toggles,
 * adding notes, saving a review, and verifying the reviewed tab.
 * Tests run serially — order matters.
 */

test.beforeAll(async () => {
  await reseedDatabase();
});

test.describe("Review flow", () => {
  test("pending tab shows unreviewed matches", async ({ page }) => {
    await page.goto("/review");

    // Should show Pending tab active with unreviewed matches
    await expect(page.getByRole("tab", { name: /Pending/i }).first()).toBeVisible();

    // Should show "games waiting for review" message
    await expect(page.getByText("waiting for review").first()).toBeVisible();

    // Pending hint text should be visible
    await expect(page.getByText("Click topics to mark").first()).toBeVisible();

    // There should be at least one match card visible
    const matchCards = page.locator('[class*="surface-glow"]');
    await expect(matchCards.first()).toBeVisible();
  });

  test("review a game with topic toggle and notes", async ({ page }) => {
    await page.goto("/review");

    // Target the first expanded PendingReviewCard
    const firstCard = page.locator('[class*="surface-glow"]').first();

    // Click a topic button to toggle it as highlight (first click = highlight)
    const topicButtons = firstCard
      .locator("button")
      .filter({ hasText: /Laning phase|Wave management|Trading|Vision/i });
    const firstTopic = topicButtons.first();
    if (await firstTopic.isVisible().catch(() => false)) {
      await firstTopic.click();
    }

    // Type a note in the markdown textarea
    const noteTextarea = firstCard.locator("textarea").first();
    if (await noteTextarea.isVisible().catch(() => false)) {
      await noteTextarea.fill("This is an E2E test review note");
    }

    // Click "Save & mark reviewed"
    const saveButton = firstCard.getByText("Save & mark reviewed");
    await saveButton.click();

    // Wait for toast confirmation
    await expect(page.getByText("Review saved!")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("reviewed tab shows reviewed matches", async ({ page }) => {
    await page.goto("/review");

    // Click the Reviewed tab
    await page
      .getByRole("tab", { name: /Reviewed/i })
      .first()
      .click();

    // Should display reviewed games count
    await expect(page.getByText("reviewed game").first()).toBeVisible({ timeout: 10_000 });

    // At least some seeded matches are reviewed (~30%)
    const reviewedCards = page.locator('[class*="surface-glow"]');
    await expect(reviewedCards.first()).toBeVisible();
  });
});

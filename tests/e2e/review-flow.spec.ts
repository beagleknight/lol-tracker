import { test, expect } from "@playwright/test";

import { reseedDatabase } from "./helpers/reseed";

/**
 * E2E: Review lifecycle (2-tab system)
 *
 * Covers: viewing pending matches, clicking topic toggles,
 * adding notes, saving a review, skipping a review,
 * bulk mark all as reviewed, and verifying the reviewed tab.
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

  test("skip a pending review without adding any data", async ({ page }) => {
    await page.goto("/review");

    // Wait for a pending card to be visible
    const firstCard = page.locator('[class*="surface-glow"]').first();
    await expect(firstCard).toBeVisible();

    // Click the Skip button on the first expanded card
    const skipButton = firstCard.getByText("Skip");
    await expect(skipButton).toBeVisible();
    await skipButton.click();

    // Wait for toast confirmation
    await expect(page.getByText("Game skipped")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("bulk mark all pending reviews as reviewed", async ({ page }) => {
    await page.goto("/review");

    // Wait for pending matches to load
    await expect(page.getByText("waiting for review").first()).toBeVisible();

    // Click "Mark all reviewed" button
    const markAllButton = page.getByRole("button", { name: /Mark all reviewed/i }).first();
    await expect(markAllButton).toBeVisible();
    await markAllButton.click();

    // Confirmation dialog should appear
    await expect(page.getByText("This will skip VOD review")).toBeVisible({ timeout: 5_000 });

    // Confirm the action by clicking the confirm button in the dialog
    const confirmButton = page.getByRole("button", { name: /Mark all reviewed/i }).last();
    await confirmButton.click();

    // Wait for toast confirmation (e.g., "Marked 33 games as reviewed.")
    await expect(page.getByText(/games? as reviewed/i)).toBeVisible({
      timeout: 15_000,
    });

    // Should now show "All caught up!" empty state
    await expect(page.getByText("All caught up!").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("reviewed tab shows topic labels for reviewed matches", async ({ page }) => {
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

    // Topic labels should render on reviewed match highlights (seed data has topics)
    const topicLabel = page
      .getByText(
        /Laning phase|Wave management|Trading|Vision|Roaming|Team fighting|Objective control|Positioning/i,
      )
      .first();
    await expect(topicLabel).toBeVisible({ timeout: 10_000 });
  });

  test("match list page shows topic labels in highlights", async ({ page }) => {
    await page.goto("/matches");
    const main = page.getByRole("main");

    // Wait for match list to load
    await expect(main.locator('a[href*="/matches/"]').first()).toBeVisible({ timeout: 10_000 });

    // At least one match card should display a topic label from its highlights
    const topicLabel = main
      .getByText(
        /Laning phase|Wave management|Trading|Vision|Roaming|Team fighting|Objective control|Positioning/i,
      )
      .first();
    try {
      await expect(topicLabel).toBeVisible({ timeout: 10_000 });
    } catch {
      await page.reload();
      await expect(topicLabel).toBeVisible({ timeout: 10_000 });
    }
  });

  test("match detail page shows topic labels in highlights", async ({ page }) => {
    await page.goto("/matches");
    const main = page.getByRole("main");

    // Find a match card that has a topic label (reviewed match with highlights)
    const topicLabel = main
      .getByText(
        /Laning phase|Wave management|Trading|Vision|Roaming|Team fighting|Objective control|Positioning/i,
      )
      .first();
    await expect(topicLabel).toBeVisible({ timeout: 10_000 });

    // Click on the match card link containing the topic label to go to detail
    const matchLink = topicLabel.locator('xpath=ancestor::a[contains(@href, "/matches/")]');
    const href = await matchLink.getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(href!);
    const detailMain = page.getByRole("main");

    // Topic labels should render in the highlights display
    const detailTopicLabel = detailMain
      .getByText(
        /Laning phase|Wave management|Trading|Vision|Roaming|Team fighting|Objective control|Positioning/i,
      )
      .first();
    try {
      await expect(detailTopicLabel).toBeVisible({ timeout: 10_000 });
    } catch {
      await page.reload();
      await expect(detailTopicLabel).toBeVisible({ timeout: 10_000 });
    }
  });

  test("dashboard shows topic labels in recent match highlights", async ({ page }) => {
    await page.goto("/dashboard");
    const main = page.getByRole("main");

    // Wait for dashboard to load
    await expect(main.locator('[class*="surface-glow"]').first()).toBeVisible({ timeout: 10_000 });

    // Topic labels should render on match cards with highlights
    const topicLabel = main
      .getByText(
        /Laning phase|Wave management|Trading|Vision|Roaming|Team fighting|Objective control|Positioning/i,
      )
      .first();
    try {
      await expect(topicLabel).toBeVisible({ timeout: 10_000 });
    } catch {
      await page.reload();
      await expect(topicLabel).toBeVisible({ timeout: 10_000 });
    }
  });
});

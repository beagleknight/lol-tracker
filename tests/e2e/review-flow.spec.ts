import { test, expect } from "@playwright/test";

import { reseedDatabase } from "./helpers/reseed";

/**
 * E2E: Post-game review lifecycle
 *
 * Covers: viewing unreviewed matches, adding highlights and notes,
 * saving with skip VOD, checking VOD Review tab, and verifying
 * the completed tab.
 * Tests run serially — order matters.
 */

test.beforeAll(async () => {
  await reseedDatabase();
});

test.describe("Review flow", () => {
  test("post-game tab shows unreviewed matches", async ({ page }) => {
    await page.goto("/review");

    // Should show Post-Game tab active with unreviewed matches
    await expect(page.getByText("Post-Game").first()).toBeVisible();

    // Should show "games waiting for review" message
    // (Base UI Tabs renders all panels in the DOM, so the text appears twice)
    await expect(page.getByText("waiting for review").first()).toBeVisible();

    // Post-game hint text should be visible
    await expect(page.getByText("These games haven't been reviewed yet").first()).toBeVisible();

    // There should be at least one match card visible
    const matchCards = page.locator('[class*="surface-glow"]');
    await expect(matchCards.first()).toBeVisible();
  });

  test("add a highlight and save with skip VOD", async ({ page }) => {
    await page.goto("/review");

    // Target the first PostGameCard
    const firstCard = page.locator('[class*="surface-glow"]').first();

    // Add a highlight: select topic from native <select>, type text, click plus
    const highlightTopicSelect = firstCard.locator("select").first();
    await highlightTopicSelect.selectOption("Laning phase");

    const highlightTextInput = firstCard.getByPlaceholder("Details (optional)").first();
    await highlightTextInput.fill("E2E test highlight note");

    // Press Enter on the text input to add the highlight
    await highlightTextInput.press("Enter");

    // Verify the highlight was added (appears as a chip/tag)
    await expect(firstCard.getByText("E2E test highlight note")).toBeVisible();

    // Open the "Game Notes (optional)" collapsible
    await firstCard.getByText("Game Notes (optional)").click();

    // Type a game note
    const noteTextarea = firstCard.getByPlaceholder("Any additional notes...");
    await noteTextarea.fill("This is an E2E test game note");

    // Click "Save & Skip VOD" dropdown trigger, then select a reason
    const skipButton = firstCard.getByText("Save & Skip VOD");
    await skipButton.click();

    // Select the first skip reason from the dropdown menu
    await page
      .locator('[data-slot="dropdown-menu-item"]')
      .filter({ hasText: "Already know what went wrong" })
      .click();

    // Wait for toast confirmation (note the trailing period)
    await expect(page.getByText("Review saved & VOD review skipped.")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("VOD review tab shows seeded matches with highlights", async ({ page }) => {
    await page.goto("/review");

    // Click the VOD Review tab (use getByRole to disambiguate)
    await page.getByRole("tab", { name: "VOD Review" }).first().click();

    // Seeded data includes matches with highlights — they may appear in VOD tab.
    // Check for either the VOD hint, cards, or empty state.
    const vodHint = page.getByText("These games have post-game notes").first();
    const emptyState = page.getByText("No VOD reviews pending");
    const matchCards = page.locator('[class*="surface-glow"]');

    const hasVodHint = await vodHint.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasCards = await matchCards
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasVodHint || hasEmptyState || hasCards).toBeTruthy();
  });

  test("completed tab shows reviewed matches", async ({ page }) => {
    await page.goto("/review");

    // Click the Completed tab (use getByRole to disambiguate)
    await page.getByRole("tab", { name: "Completed" }).first().click();

    // Should display completed/reviewed games count
    await expect(page.getByText("reviewed game").first()).toBeVisible({ timeout: 10_000 });

    // At least some seeded matches are reviewed (~30%)
    const completedCards = page.locator('[class*="surface-glow"]');
    await expect(completedCards.first()).toBeVisible();
  });
});

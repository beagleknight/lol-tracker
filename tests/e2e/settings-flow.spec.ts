import { test, expect } from "@playwright/test";

import { reseedDatabase } from "./helpers/reseed";

/**
 * E2E: Settings page management
 *
 * Covers: language switching, locale switching (date format preview),
 * duo partner set/clear. Tests run serially — order matters.
 */

test.beforeAll(async () => {
  await reseedDatabase();
});

test.describe("Settings flow", () => {
  test("settings page shows current state", async ({ page }) => {
    await page.goto("/settings");

    // Title should be visible
    await expect(page.getByText("Settings").first()).toBeVisible();

    // Riot account card should show "Linked" since DemoPlayer has a Riot account
    await expect(page.getByText("Linked").first()).toBeVisible();

    // Language & Region card should be visible
    await expect(page.getByText("Language & Region")).toBeVisible();

    // Duo Partner card should be visible (DemoPlayer is linked)
    await expect(page.getByText("Duo Partner").first()).toBeVisible();
  });

  test("change language to Spanish and back to English", async ({ page }) => {
    await page.goto("/settings");

    // ----- Switch to Spanish -----
    // Use role-based selector instead of #id to avoid strict mode violations
    // from SSR hydration briefly producing duplicate DOM nodes on CI
    const languageTrigger = page.getByRole("combobox", { name: "UI Language" });
    await languageTrigger.click();

    // Select "Español" from the Base UI Select popup
    await page.locator('[data-slot="select-item"]').filter({ hasText: "Español" }).click();

    // Wait for toast confirmation (in English, since we're still on English)
    await expect(page.getByText("Language updated")).toBeVisible({
      timeout: 10_000,
    });

    // Reload to apply the new language
    await page.reload();
    await expect(page.getByText("Ajustes").first()).toBeVisible({
      timeout: 10_000,
    });

    // ----- Switch back to English -----
    // In Spanish, the label is "Idioma de la interfaz"
    const languageTriggerEs = page.getByRole("combobox", { name: "Idioma de la interfaz" });
    await languageTriggerEs.click();

    await page.locator('[data-slot="select-item"]').filter({ hasText: "English" }).click();

    // Toast fires in Spanish since the page is currently in Spanish
    await expect(page.getByText("Idioma actualizado")).toBeVisible({
      timeout: 10_000,
    });

    // Reload to apply the new language
    await page.reload();

    // Page should be back in English
    await expect(page.getByText("Settings").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("change locale and verify date format preview", async ({ page }) => {
    await page.goto("/settings");

    // Click the locale select trigger — use role-based selector to avoid
    // strict mode violations from SSR hydration duplicating DOM nodes on CI
    const localeTrigger = page.getByRole("combobox", { name: "Date & number format" });
    await localeTrigger.click();

    // Select US format from the Base UI Select popup
    await page.locator('[data-slot="select-item"]').filter({ hasText: "English (US)" }).click();

    // Wait for toast
    await expect(page.getByText("Language & region updated").first()).toBeVisible({
      timeout: 10_000,
    });

    // The preview should show a date
    await expect(page.getByText("Preview:")).toBeVisible();

    // Switch back to UK format for cleanup
    await localeTrigger.click();
    await page.locator('[data-slot="select-item"]').filter({ hasText: "English (UK)" }).click();

    // The previous toast may still be visible, so use .first() to avoid
    // strict mode violations when two toasts are stacked
    await expect(page.getByText("Language & region updated").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("set duo partner and verify", async ({ page }) => {
    await page.goto("/settings");

    // Wait for duo partner section to load (it fetches async).
    // After loading, either the Clear button or the select prompt appears.
    const clearButton = page.getByRole("button", { name: "Clear" });
    const selectPrompt = page.getByText("Select a registered user as your duo partner:");
    await expect(clearButton.or(selectPrompt)).toBeVisible({ timeout: 15_000 });

    // If there's already a duo partner set, clear it first
    const hasDuoPartner = await clearButton.isVisible().catch(() => false);
    if (hasDuoPartner) {
      await clearButton.click();
      await expect(page.getByText("Duo partner cleared.")).toBeVisible({
        timeout: 10_000,
      });
    }

    // Now the selection prompt should appear
    await expect(selectPrompt).toBeVisible({ timeout: 10_000 });

    // Click "Set" button next to a user
    const setButton = page.getByRole("button", { name: "Set" }).first();
    await setButton.click();

    // Wait for confirmation
    await expect(page.getByText("Duo partner set to")).toBeVisible({
      timeout: 10_000,
    });

    // The "Set" badge should now appear (indicating partner is set)
    await expect(
      page.locator('[data-slot="badge"]').filter({ hasText: "Set" }).first(),
    ).toBeVisible();
  });

  test("clear duo partner and verify", async ({ page }) => {
    await page.goto("/settings");

    // Wait for the duo partner to load
    await expect(page.getByText("Duo Partner").first()).toBeVisible({ timeout: 10_000 });

    // The Clear button should be visible since we set a partner in the previous test
    const clearButton = page.getByRole("button", { name: "Clear" });
    await expect(clearButton).toBeVisible({ timeout: 10_000 });

    // Click Clear
    await clearButton.click();

    // Wait for confirmation
    await expect(page.getByText("Duo partner cleared.")).toBeVisible({
      timeout: 10_000,
    });

    // Should now show "Not Set" badge
    await expect(page.locator('[data-slot="badge"]').filter({ hasText: "Not Set" })).toBeVisible();

    // Should show the selection prompt again
    await expect(page.getByText("Select a registered user as your duo partner")).toBeVisible({
      timeout: 10_000,
    });
  });
});

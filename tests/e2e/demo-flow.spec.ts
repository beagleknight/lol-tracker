import { test, expect } from "@playwright/test";

import { reseedDatabase } from "./helpers/reseed";

/**
 * E2E: Public demo mode
 *
 * Verifies the /demo entry point auto-signs-in and redirects to /dashboard,
 * where the demo banner is visible, write UI is hidden, sidebar shows the
 * demo account badge, and match cards link to /matches/*.
 *
 * The demo user now uses the real (app) routes with isDemoUser=true in
 * the session, so all links and navigation work without special-casing.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeAll(async () => {
  await reseedDatabase();
});

test.describe("Demo mode", () => {
  test("demo entry auto-signs in and redirects to dashboard", async ({ page }) => {
    await page.goto("/demo");

    // Should redirect to /dashboard after auto-sign-in
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Demo banner is visible
    await expect(page.getByText("You're viewing the demo").first()).toBeVisible();

    // "Sign up for free" link appears (banner or sidebar)
    await expect(page.getByRole("link", { name: /sign up for free/i }).first()).toBeVisible();

    // Sync button should NOT be visible in demo mode
    await expect(page.getByRole("button", { name: /sync/i })).toBeHidden();
  });

  test("demo user can navigate to all pages via real routes", async ({ page }) => {
    // Sign in via demo entry
    await page.goto("/demo");
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // Navigate to matches
    await page.goto("/matches");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });
    await expect(page).not.toHaveURL(/\/login/);

    // Match cards should link to /matches/ (real routes, not /demo/matches/)
    await expect(main.locator("a[href*='/matches/']").first()).toBeVisible();
  });

  test("demo match detail page loads", async ({ page }) => {
    await page.goto("/demo");
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // Use a known seeded match ID
    await page.goto("/matches/EUW1_7000000010");
    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Should show match content, not a login redirect
    await expect(page).not.toHaveURL(/\/login/);
    // Demo banner persists
    await expect(page.getByText("You're viewing the demo").first()).toBeVisible();
  });

  test("sidebar shows demo account badge", async ({ page }) => {
    await page.goto("/demo");
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // Demo account badge in sidebar
    await expect(page.getByText("Demo account").first()).toBeVisible();
  });

  test("landing page has demo CTA that navigates to /demo", async ({ page }) => {
    await page.goto("/");

    // "Try the demo" button/link should be visible
    const demoCta = page.getByRole("link", { name: /try the demo/i });
    await expect(demoCta).toBeVisible();
    await expect(demoCta).toHaveAttribute("href", "/demo");
  });
});

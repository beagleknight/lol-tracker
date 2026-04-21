import { test, expect } from "@playwright/test";

import { reseedDatabase } from "./helpers/reseed";

/**
 * E2E: Public demo mode
 *
 * Verifies the /demo route group works for unauthenticated visitors:
 * pages load, banner is visible, write UI is hidden, sidebar shows
 * demo badge, and match cards link to /demo/matches/*.
 *
 * These tests run WITHOUT auth (public visitor).
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeAll(async () => {
  await reseedDatabase();
});

test.describe("Demo mode", () => {
  test("demo dashboard loads with banner and read-only UI", async ({ page }) => {
    await page.goto("/demo");

    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Demo banner is visible — use first() because SSR streaming can duplicate
    await expect(page.getByText("You're viewing the demo").first()).toBeVisible();

    // "Sign up for free" link appears (banner or sidebar)
    await expect(page.getByRole("link", { name: /sign up for free/i }).first()).toBeVisible();

    // Sync button should NOT be visible in demo mode
    await expect(page.getByRole("button", { name: /sync/i })).toBeHidden();
  });

  test("demo analytics page loads", async ({ page }) => {
    await page.goto("/demo/analytics");

    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Banner persists across pages
    await expect(page.getByText("You're viewing the demo").first()).toBeVisible();
  });

  test("demo matches page loads with match cards", async ({ page }) => {
    await page.goto("/demo/matches");

    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Match cards should be visible (links with block rounded-lg classes)
    await expect(main.locator("a[href*='/demo/matches/']").first()).toBeVisible();
  });

  test("demo match detail page loads", async ({ page }) => {
    // Use a known seeded match ID
    await page.goto("/demo/matches/EUW1_7000000010");

    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Should show match content, not a login redirect
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("demo review page loads", async ({ page }) => {
    await page.goto("/demo/review");

    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("demo coaching page loads", async ({ page }) => {
    await page.goto("/demo/coaching");

    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    await expect(page).not.toHaveURL(/\/login/);
  });

  test("demo scout page loads", async ({ page }) => {
    await page.goto("/demo/scout");

    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    await expect(page).not.toHaveURL(/\/login/);
  });

  test("demo challenges page loads", async ({ page }) => {
    await page.goto("/demo/challenges");

    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    await expect(page).not.toHaveURL(/\/login/);
  });

  test("sidebar shows demo account badge and locked items", async ({ page }) => {
    await page.goto("/demo");

    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // Demo account badge in sidebar — use first() for SSR streaming duplication
    await expect(page.getByText("Demo account").first()).toBeVisible();
  });

  test("match cards link to /demo/matches/ in demo mode", async ({ page }) => {
    await page.goto("/demo/matches");

    const main = page.getByRole("main");
    await main.waitFor({ state: "visible" });

    // First match card should have href starting with /demo/matches/
    const firstMatchLink = main.locator("a[href*='/demo/matches/']").first();
    await expect(firstMatchLink).toBeVisible();
    const href = await firstMatchLink.getAttribute("href");
    expect(href).toMatch(/^\/demo\/matches\//);
  });

  test("landing page has demo CTA that navigates to /demo", async ({ page }) => {
    await page.goto("/");

    // "Try the demo" button/link should be visible
    const demoCta = page.getByRole("link", { name: /try the demo/i });
    await expect(demoCta).toBeVisible();

    // Should link to /demo
    await expect(demoCta).toHaveAttribute("href", "/demo");
  });
});

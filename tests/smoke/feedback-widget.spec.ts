import { test, expect } from "@playwright/test";

/**
 * Smoke tests for the Canny feedback widget.
 *
 * These tests verify the widget integration WITHOUT submitting any
 * data to the Canny board. We intercept the SDK and SSO requests
 * to ensure the integration plumbing works correctly.
 *
 * The feedback trigger is a sidebar nav item (not a floating button).
 * We block the Canny SDK globally via beforeEach so the external
 * script never prevents the `load` event from firing.
 */

test.describe("Feedback widget", () => {
  test.beforeEach(async ({ page }) => {
    // Block Canny SDK and SSO in all tests to prevent external network
    // requests from hanging the page load event.
    await page.route("**/sdk.canny.io/**", (route) => {
      void route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "window.Canny = function() {};",
      });
    });

    await page.route("**/api/canny/sso", (route) => {
      void route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ token: "mock-sso-token" }),
      });
    });
  });

  test("feedback button is visible in sidebar", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("main").waitFor({ state: "visible" });

    const feedbackButton = page.getByRole("button", { name: /^feedback$|^sugerencias$/i });
    await expect(feedbackButton).toBeVisible();
  });

  test("clicking the sidebar button opens the feedback panel", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("main").waitFor({ state: "visible" });

    const feedbackButton = page.getByRole("button", { name: /^feedback$|^sugerencias$/i });
    await feedbackButton.click();

    const panel = page.getByRole("dialog", {
      name: /feedback|sugerencias/i,
    });
    await expect(panel).toBeVisible();
  });

  test("panel closes on Escape key", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("main").waitFor({ state: "visible" });

    const feedbackButton = page.getByRole("button", { name: /^feedback$|^sugerencias$/i });
    await feedbackButton.click();

    const panel = page.getByRole("dialog", {
      name: /feedback|sugerencias/i,
    });
    await expect(panel).toBeVisible();

    await page.keyboard.press("Escape");

    // Panel should slide out (translate-x-full) — check it's no longer in viewport
    await expect(panel).toHaveClass(/translate-x-full/);
  });

  test("panel close button closes the panel", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("main").waitFor({ state: "visible" });

    const feedbackButton = page.getByRole("button", { name: /^feedback$|^sugerencias$/i });
    await feedbackButton.click();

    const panel = page.getByRole("dialog", {
      name: /feedback|sugerencias/i,
    });
    await expect(panel).toBeVisible();

    // Close via the panel's close button
    const closeButton = panel.getByRole("button", { name: /close|cerrar/i });
    await closeButton.click();

    await expect(panel).toHaveClass(/translate-x-full/);
  });

  test("SSO endpoint is called when panel opens", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("main").waitFor({ state: "visible" });

    // Start waiting for the SSO request before clicking
    const ssoRequestPromise = page.waitForRequest((req) => req.url().includes("/api/canny/sso"), {
      timeout: 10000,
    });

    const feedbackButton = page.getByRole("button", { name: /^feedback$|^sugerencias$/i });
    await feedbackButton.click();

    // Wait for the SSO request to be made
    const ssoRequest = await ssoRequestPromise;
    expect(ssoRequest.url()).toContain("/api/canny/sso");
  });

  test("Canny SDK script is requested when panel opens", async ({ page }) => {
    let sdkRequested = false;

    // Override the SDK route to track requests
    await page.route("**/sdk.canny.io/**", (route) => {
      sdkRequested = true;
      void route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "window.Canny = function() {};",
      });
    });

    await page.goto("/dashboard");
    await page.getByRole("main").waitFor({ state: "visible" });

    const feedbackButton = page.getByRole("button", { name: /^feedback$|^sugerencias$/i });
    await feedbackButton.click();

    // Wait for SDK to be requested
    await page.waitForTimeout(2000);

    expect(sdkRequested).toBe(true);
  });
});

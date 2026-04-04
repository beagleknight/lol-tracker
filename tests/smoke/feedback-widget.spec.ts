import { test, expect } from "@playwright/test";

/**
 * Smoke tests for the Canny feedback widget.
 *
 * These tests verify the widget integration WITHOUT submitting any
 * data to the Canny board. We intercept the SDK and SSO requests
 * to ensure the integration plumbing works correctly.
 *
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

  test("floating button is visible on authenticated pages", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("main").waitFor({ state: "visible" });

    const feedbackButton = page.getByRole("button", { name: /send feedback|enviar sugerencias/i });
    await expect(feedbackButton).toBeVisible();
  });

  test("clicking the button opens the feedback panel", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("main").waitFor({ state: "visible" });

    const feedbackButton = page.getByRole("button", { name: /send feedback|enviar sugerencias/i });
    await feedbackButton.click();

    const panel = page.getByRole("dialog", {
      name: /feedback|sugerencias/i,
    });
    await expect(panel).toBeVisible();
  });

  test("panel closes on Escape key", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("main").waitFor({ state: "visible" });

    const feedbackButton = page.getByRole("button", { name: /send feedback|enviar sugerencias/i });
    await feedbackButton.click();

    const panel = page.getByRole("dialog", {
      name: /feedback|sugerencias/i,
    });
    await expect(panel).toBeVisible();

    await page.keyboard.press("Escape");

    // Panel should slide out (translate-x-full) — check it's no longer in viewport
    await expect(panel).toHaveClass(/translate-x-full/);
  });

  test("clicking the button again closes the panel", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("main").waitFor({ state: "visible" });

    const feedbackButton = page.getByRole("button", { name: /send feedback|enviar sugerencias/i });

    // Open
    await feedbackButton.click();
    const panel = page.getByRole("dialog", {
      name: /feedback|sugerencias/i,
    });
    await expect(panel).toBeVisible();

    // Close by clicking button again
    await feedbackButton.click();
    await expect(panel).toHaveClass(/translate-x-full/);
  });

  test("SSO endpoint is called when panel opens", async ({ page }) => {
    let ssoCalled = false;

    // Override the SSO route to track calls
    await page.route("**/api/canny/sso", (route) => {
      ssoCalled = true;
      void route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ token: "mock-sso-token" }),
      });
    });

    await page.goto("/dashboard");
    await page.getByRole("main").waitFor({ state: "visible" });

    const feedbackButton = page.getByRole("button", { name: /send feedback|enviar sugerencias/i });
    await feedbackButton.click();

    // Wait a moment for the fetch to happen
    await page.waitForTimeout(1000);

    expect(ssoCalled).toBe(true);
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

    const feedbackButton = page.getByRole("button", { name: /send feedback|enviar sugerencias/i });
    await feedbackButton.click();

    // Wait for SDK to be requested
    await page.waitForTimeout(2000);

    expect(sdkRequested).toBe(true);
  });
});

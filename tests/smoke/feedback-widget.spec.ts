import { test, expect } from "@playwright/test";

/**
 * Smoke tests for the Canny feedback page.
 *
 * These tests verify the /feedback page and sidebar navigation
 * WITHOUT submitting any data to the Canny board. We intercept
 * the SDK and SSO requests to ensure the integration plumbing
 * works correctly.
 */

test.describe("Feedback page", () => {
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

  test("feedback link is visible in sidebar", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("main").waitFor({ state: "visible" });

    const feedbackLink = page.getByRole("link", { name: /^feedback$|^sugerencias$/i });
    await expect(feedbackLink).toBeVisible();
    await expect(feedbackLink).toHaveAttribute("href", "/feedback");
  });

  test("feedback page renders with heading", async ({ page }) => {
    await page.goto("/feedback");
    await page.getByRole("main").waitFor({ state: "visible" });

    const heading = page.getByRole("heading", {
      name: /feedback|sugerencias/i,
      level: 1,
    });
    await expect(heading).toBeVisible();
  });

  test("SSO endpoint is called on page load", async ({ page }) => {
    // Start waiting for the SSO request before navigating
    const ssoRequestPromise = page.waitForRequest((req) => req.url().includes("/api/canny/sso"), {
      timeout: 10000,
    });

    await page.goto("/feedback");
    await page.getByRole("main").waitFor({ state: "visible" });

    // Wait for the SSO request to be made
    const ssoRequest = await ssoRequestPromise;
    expect(ssoRequest.url()).toContain("/api/canny/sso");
  });

  test("Canny SDK script is requested on page load", async ({ page }) => {
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

    await page.goto("/feedback");
    await page.getByRole("main").waitFor({ state: "visible" });

    // Wait for SDK to be requested
    await page.waitForTimeout(2000);

    expect(sdkRequested).toBe(true);
  });
});

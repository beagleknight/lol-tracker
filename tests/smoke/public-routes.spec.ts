import { test, expect } from "@playwright/test";

test.describe("Public routes", () => {
  // Public routes don't need auth — use a fresh context
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/ — landing page loads", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("/login — login page loads with demo user picker", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("button", { name: /DemoPlayer/ })
    ).toBeVisible();
  });
});

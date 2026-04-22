import { test, expect } from "@playwright/test";

test.describe("Public routes", () => {
  // Public routes don't need auth — use a fresh context
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/ — landing page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // Verify key content rendered (hero CTA + sign-in link)
    await expect(page.getByRole("link", { name: /sign in|iniciar sesión/i })).toBeVisible();

    // No uncaught JS errors
    expect(errors).toEqual([]);
  });

  test("/login — login page loads with demo user picker", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("button", { name: /SeedPlayer/ })).toBeVisible();
  });
});

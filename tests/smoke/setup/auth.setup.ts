import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth", "demo-user.json");

/**
 * Authenticate as the DemoPlayer user and save the session state.
 * This runs before all smoke tests via the "setup" project dependency.
 */
setup("authenticate as DemoPlayer", async ({ page }) => {
  await page.goto("/login");

  // Click the DemoPlayer card to log in
  await page.getByText("DemoPlayer").first().click();

  // Wait for redirect to dashboard (confirms login succeeded)
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);

  // Save auth state for reuse by smoke test projects
  await page.context().storageState({ path: authFile });
});

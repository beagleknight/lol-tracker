import { test, expect } from "@playwright/test";

test.describe("API routes", () => {
  test("/api/auth/session — returns session JSON", async ({ request }) => {
    const response = await request.get("/api/auth/session");
    expect(response.status()).toBe(200);

    const body = await response.json();
    // Logged in as DemoPlayer — session should have user data
    expect(body.user).toBeDefined();
    expect(body.user.name).toBe("DemoPlayer");
  });
});

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

  test("/api/export/matches — returns CSV with correct headers", async ({ request }) => {
    const response = await request.get("/api/export/matches");
    expect(response.status()).toBe(200);

    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("text/csv");

    const disposition = response.headers()["content-disposition"];
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("matches-export-");

    const body = await response.text();
    const lines = body.trim().split("\n");
    // At least the header row + some seeded matches
    expect(lines.length).toBeGreaterThan(1);
    // Verify CSV header columns
    expect(lines[0]).toBe(
      "Match ID,Date,Result,Champion,Matchup,Keystone,Kills,Deaths,Assists,CS,CS/min,Duration,Gold,Vision Score,Queue ID,Reviewed,Comment,Review Notes,VOD URL,Duo Partner Champion"
    );
  });

  test("/api/export/matches — respects result filter", async ({ request }) => {
    const response = await request.get("/api/export/matches?result=Victory");
    expect(response.status()).toBe(200);

    const body = await response.text();
    const lines = body.trim().split("\n");
    // Skip header, check all data rows contain "Victory"
    for (const line of lines.slice(1)) {
      expect(line).toContain("Victory");
    }
  });
});

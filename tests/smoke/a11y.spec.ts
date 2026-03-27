import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * WCAG 2.1 AA accessibility scan for all key pages.
 *
 * Uses axe-core via @axe-core/playwright to detect violations.
 * Each page is scanned independently — failures report the specific
 * violation IDs and affected nodes so they can be triaged.
 *
 * These run as smoke tests (parallel, fast) since they only need
 * to visit a page and scan — no stateful interactions required.
 */

const authenticatedPages = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Matches", path: "/matches" },
  { name: "Analytics", path: "/analytics" },
  { name: "Scout", path: "/scout" },
  { name: "Coaching", path: "/coaching" },
  { name: "Review", path: "/review" },
  { name: "Goals", path: "/goals" },
  { name: "Settings", path: "/settings" },
];

const publicPages = [{ name: "Login", path: "/login" }];

test.describe("Accessibility — authenticated pages", () => {
  for (const { name, path } of authenticatedPages) {
    test(`${name} (${path}) has no WCAG 2.1 AA violations`, async ({
      page,
    }) => {
      await page.goto(path);
      // Wait for main content to be visible before scanning
      await page.getByRole("main").waitFor({ state: "visible" });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(results.violations, formatViolations(results.violations)).toEqual(
        []
      );
    });
  }
});

test.describe("Accessibility — public pages", () => {
  // Public pages don't need auth
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const { name, path } of publicPages) {
    test(`${name} (${path}) has no WCAG 2.1 AA violations`, async ({
      page,
    }) => {
      await page.goto(path);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(results.violations, formatViolations(results.violations)).toEqual(
        []
      );
    });
  }
});

/**
 * Format axe violations into a readable string for test failure messages.
 */
function formatViolations(
  violations: Awaited<
    ReturnType<InstanceType<typeof AxeBuilder>["analyze"]>
  >["violations"]
): string {
  if (violations.length === 0) return "No violations";

  return violations
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 3) // Show first 3 affected nodes
        .map((n) => `    - ${n.html.slice(0, 120)}`)
        .join("\n");
      const more = v.nodes.length > 3 ? `\n    ... and ${v.nodes.length - 3} more` : "";
      return `[${v.impact}] ${v.id}: ${v.description}\n  Help: ${v.helpUrl}\n  Affected nodes:\n${nodes}${more}`;
    })
    .join("\n\n");
}

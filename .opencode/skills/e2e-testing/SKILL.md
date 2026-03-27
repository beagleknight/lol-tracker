---
name: e2e-testing
description: Write and debug Playwright E2E tests for lol-tracker. Covers test structure, selector strategies, server action testing patterns, seed data reference, and CI-specific gotchas.
---

## What I do

Guide writing robust Playwright E2E tests that work both locally and in CI. This skill captures project-specific DOM quirks, Next.js revalidation gotchas, and Base UI component patterns that are not obvious from docs alone.

## When to use me

- Writing new E2E test specs
- Debugging flaky or failing E2E tests
- Adding new interactive flows to the app that need test coverage
- Investigating CI-only test failures

## Test structure

### File layout

```
tests/
  smoke/              # Fast parallel checks (route loads, nav, key elements)
    setup/
      global-setup.ts # Seeds DB, runs before all projects
      auth.setup.ts   # Logs in as DemoPlayer, saves auth state
    *.spec.ts
  e2e/                # Full interactive flow tests (serial)
    helpers/
      reseed.ts       # Re-seeds DB — call in beforeAll of each spec
    *.spec.ts
```

### Naming convention

- `*.spec.ts` for Playwright tests (smoke and E2E)
- `*.test.ts` reserved for future Vitest unit tests (colocated in `src/`)

### Playwright config (multi-project)

Three projects in `playwright.config.ts`:
1. **setup** — auth login, saves storage state
2. **smoke** — fast, `fullyParallel: true`, reuses auth
3. **e2e** — serial, `workers: 1`, `fullyParallel: false`, `timeout: 60_000`

E2E tests run serially with a single worker because they share one SQLite file and the running Next.js server holds a persistent connection to it.

### Test isolation

Each spec file calls `reseedDatabase()` in `beforeAll`. This runs `npm run db:seed` which `DELETE FROM`s all tables and re-inserts deterministic data. It does NOT delete the `.db` file — doing so would cause `SQLITE_READONLY_DBMOVED` on the running server.

```ts
import { reseedDatabase } from "./helpers/reseed";

test.describe("My flow", () => {
  test.beforeAll(async () => {
    await reseedDatabase();
  });
  // tests run in order within the describe block...
});
```

### Auth

All E2E tests reuse the demo mode auth state saved by `auth.setup.ts`. The `storageState` is configured in the e2e project — no need to log in again.

## Selector rules — CRITICAL

### Always scope to `getByRole("main")`

Next.js production builds use React Server Component streaming, which can produce **duplicate DOM nodes** during hydration. Elements with the same `id`, same structure, rendered twice. Playwright's strict mode rejects ambiguous selectors.

```ts
// BAD — may resolve to 2+ elements in production builds
await page.locator("#coach").fill("value");
await page.locator("button.text-destructive").click();

// GOOD — scoped to main content area
const main = page.getByRole("main");
await main.locator("#coach").fill("value");
await main.locator("button.text-destructive").first().click();
```

### Use `.first()` for elements that appear in multiple contexts

Base UI renders ALL tab panel contents in the DOM simultaneously (hidden when inactive). Any text that appears across tab panels will match multiple times.

```ts
// BAD — matches in both visible and hidden tab panels
await expect(page.getByText("Wave management")).toBeVisible();

// GOOD
await expect(page.getByText("Wave management").first()).toBeVisible();
```

### Base UI component selectors

This app uses `@base-ui/react`, NOT Radix. Components use `data-slot` attributes.

| Component | Selector pattern |
|-----------|-----------------|
| Button | `[data-slot="button"]` |
| Badge | `[data-slot="badge"]` or `locator('[data-slot="badge"]:has-text("Completed")')` |
| Tab trigger | `[data-slot="tabs-trigger"]` |
| Select item | `page.locator('[data-slot="select-item"]').filter({ hasText: "..." })` |
| Dropdown item | `[data-slot="dropdown-menu-item"]` |

**Base UI DropdownMenuItem uses `onClick`, NOT `onSelect`** (that's a Radix API). If dropdown actions silently do nothing, check the handler prop name.

### Action item rows on coaching detail page

DOM structure: `row > [button(cycle), div(text+topic), div(status-badge)]`

```ts
const main = page.getByRole("main");
const row = main.getByText("Some action item text").locator("../..");
const cycleButton = row.locator("button").first();
const statusBadge = row.getByText("in progress"); // or "pending", "completed"
```

## Server action testing patterns

### The `revalidatePath` + `startTransition` conflict

When a server action calls `revalidatePath`, the server component re-renders. If that re-render triggers `redirect()` or `notFound()`, Next.js throws a special error (`NEXT_REDIRECT` or `NEXT_NOT_FOUND`) that propagates back to the client. If the client wraps the call in `startTransition` with `try/catch`, the catch block swallows the error and may show a false "failed" toast.

**Implication for tests**: Do NOT assert on toast messages for server actions that trigger redirect/notFound after revalidation. Instead:

1. **For actions that redirect** (e.g., complete session): Try `waitForURL`, fall back to `page.goto(expectedUrl)`, then verify the result.
2. **For actions that trigger notFound** (e.g., delete session): `waitForTimeout` + navigate to list page + verify item is gone.
3. **For actions that just revalidate** (e.g., cycle status): Assert on the DOM change with a reload fallback.

### Reload fallback pattern for revalidation

Server-side revalidation can be slow on CI. The DB write is synchronous but the client may not reflect changes immediately. Always add a reload fallback:

```ts
try {
  await expect(someLocator).toBeVisible({ timeout: 10_000 });
} catch {
  await page.reload();
  await expect(someLocator).toBeVisible({ timeout: 10_000 });
}
```

### `revalidatePath` does NOT cascade to child routes

`revalidatePath("/coaching")` only revalidates `/coaching`, NOT `/coaching/123` or `/coaching/action-items`. To revalidate an entire route tree, use the `"layout"` type:

```ts
revalidatePath("/coaching", "layout"); // revalidates /coaching AND all child routes
```

If a test mutates data and the page doesn't reflect the change, check whether the server action revalidates the correct path for the page under test.

### `isRedirectError` handling

Production code that uses `startTransition` with server actions that may trigger `redirect()` must re-throw redirect errors:

```ts
import { isRedirectError } from "next/dist/client/components/redirect-error";

startTransition(async () => {
  try {
    const result = await someServerAction();
    if (result && "error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Done!");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    toast.error("Failed");
  }
});
```

Without this, `redirect()` is caught and the user sees a false error toast. This is a production bug, not just a test concern.

## Seed data reference

After `npm run db:seed`, the database contains:

| Entity | Count | Key details |
|--------|-------|-------------|
| Users | 2 | DemoPlayer (admin, Riot-linked, has duo partner), DuoPartner |
| Matches | 50 | ~60% unreviewed, ~30% reviewed, ~10% skipped |
| Rank snapshots | 14 | Various ranks over time |
| Coaching sessions | 3 | 2 completed + 1 scheduled, all with "CoachKim" |
| Action items | 6 | Linked to completed sessions |
| Match highlights | 12 | On specific match IDs |
| Invites | 1 | For DemoPlayer |

- The logged-in user is always **DemoPlayer** (demo mode auto-login).
- Coach name in seed data is **"CoachKim"**.
- DemoPlayer has a duo partner set (DuoPartner).

## CI vs local differences

| Aspect | Local (dev) | CI (production build) |
|--------|------------|----------------------|
| Build | `next build && next start` | Build is a separate CI step, test just runs `next start` |
| DOM | Single render pass | Streaming may produce duplicate DOM nodes |
| Speed | Fast revalidation | Slower — needs reload fallbacks |
| SQLite | `file:./data/lol-tracker.db` | Same |
| Browser | Chromium (may need install) | Chromium (installed in CI step) |

### CI workflow

The E2E job in `.github/workflows/ci.yml`:
1. Installs deps + Chromium
2. Builds the Next.js app
3. Runs `npm run test:e2e`

It's a separate job from smoke tests. Both require the build to succeed first.

## Checklist for new E2E tests

1. [ ] Created file in `tests/e2e/` with `.spec.ts` extension
2. [ ] Called `reseedDatabase()` in `beforeAll`
3. [ ] All selectors scoped to `page.getByRole("main")` or use `.first()`
4. [ ] No bare `#id` selectors without scoping
5. [ ] Server action assertions use reload fallbacks, not toast messages
6. [ ] Tested locally with `npm run test:e2e`
7. [ ] If adding new server actions: verified `revalidatePath` covers all pages that display the affected data

## Accessibility (a11y) testing with axe-core

The project includes automated WCAG 2.1 AA accessibility scanning via `@axe-core/playwright`.

### Test file

`tests/smoke/a11y.spec.ts` — scans all key pages (authenticated + public) for violations.

### How it works

```ts
import AxeBuilder from "@axe-core/playwright";

const results = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
  .analyze();

expect(results.violations, formatViolations(results.violations)).toEqual([]);
```

### When to run

- After adding new interactive components (buttons, forms, modals)
- After changing color tokens or opacity values
- After adding new pages or routes
- Before any PR that touches UI

### Common violation types

| Violation ID | Severity | Typical cause |
|---|---|---|
| `button-name` | Critical | Icon-only buttons missing `aria-label` |
| `color-contrast` | Serious | Text color + background combo below 4.5:1 ratio |
| `aria-progressbar-name` | Serious | `<Progress>` component missing `aria-label` |
| `label` | Serious | Form inputs without associated `<label>` |
| `image-alt` | Critical | `<img>` without `alt` attribute |

### Adding a11y tests for new pages

Add the page to the `authenticatedPages` or `publicPages` array in `tests/smoke/a11y.spec.ts`:

```ts
const authenticatedPages = [
  // ... existing pages
  { name: "MyNewPage", path: "/my-new-page" },
];
```

### Excluding known issues (temporary)

If a violation cannot be fixed immediately, exclude it by rule ID:

```ts
const results = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
  .disableRules(["specific-rule-id"]) // TODO: fix and re-enable
  .analyze();
```

Always leave a TODO comment and track the exclusion in a GitHub issue.

---
name: ui-screenshots
description: Before/after screenshot workflow for UX/UI PRs, demo-mode dev server recipe, annotation technique, and CI pre-validation rules to avoid push-fail-fix cycles.
---

## What I do

Guide capturing, annotating, and embedding before/after screenshots in PRs that change UX or UI. Also covers the demo-mode dev server setup required for screenshots and the CI pre-validation discipline needed to avoid multiple push-fix cycles.

## When to use me

- Any PR that changes UX, UI layout, or visual behavior
- Taking before/after screenshots for changelog entries or PR descriptions
- Starting a demo-mode production server for manual testing or Playwright screenshots
- Before pushing a PR that touches UI, a11y, or interactive components

## Screenshot workflow

### 1. Capture "before" screenshots first

Before making any code changes, capture the current state:

```bash
# Build and start the server (see "Dev server recipe" below)
# Then use Playwright to screenshot at 1280x720
```

Store originals immediately — you cannot recapture them after code changes.

### 2. Capture "after" screenshots

After implementing changes, rebuild and restart the server, then screenshot the same pages/states.

### 3. Annotate the "after" screenshots

Use an HTML overlay technique — load the screenshot as a background image and overlay SVG annotations, then screenshot the composite with Playwright.

#### Annotation spec

- **Arrows**: Red, semi-transparent — `rgba(255, 60, 60, 0.7)` stroke, 3px width
- **Rectangles**: Rounded, semi-transparent border — `rgba(255, 60, 60, 0.55)` stroke, 2-3px width, no fill (or very light fill like `rgba(255, 60, 60, 0.05)`)
- **Labels**: White text on `rgba(255, 60, 60, 0.7)` background, 14px bold, with 4-8px padding and border-radius
- **Small elements**: If a highlight box/circle would be too small to see, skip it and use only an arrow with a label
- **Breathing room**: Arrows and labels must have significant distance from their target element — at least 40-60px of clear space between the arrowhead and the highlighted area. Annotations that are too close to their targets look cramped and are hard to read. Think of the arrow as "pointing from afar" rather than touching the element. A good reference: if the arrow barely needs to travel, it's too close.

#### Annotation technique

Create a temporary HTML file that composites the screenshot with SVG overlays:

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        margin: 0;
        width: 1280px;
        height: 720px;
        overflow: hidden;
      }
      .container {
        position: relative;
        width: 1280px;
        height: 720px;
        background: url("./after-screenshot.png") no-repeat center/cover;
      }
      svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
        <!-- Arrow: line + arrowhead -->
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,60,60,0.7)" />
          </marker>
        </defs>

        <!-- Highlight rectangle -->
        <rect
          x="100"
          y="200"
          width="300"
          height="40"
          rx="6"
          fill="none"
          stroke="rgba(255,60,60,0.55)"
          stroke-width="2.5"
        />

        <!-- Arrow pointing to element -->
        <line
          x1="80"
          y1="160"
          x2="100"
          y2="195"
          stroke="rgba(255,60,60,0.7)"
          stroke-width="3"
          marker-end="url(#arrow)"
        />

        <!-- Label -->
        <rect x="20" y="140" width="120" height="24" rx="4" fill="rgba(255,60,60,0.7)" />
        <text x="80" y="157" fill="white" font-size="14" font-weight="bold" text-anchor="middle">
          New badge
        </text>
      </svg>
    </div>
  </body>
</html>
```

Serve this with a temporary HTTP server (Playwright cannot load `file://` URLs reliably):

```bash
# CRITICAL: Start with `& disown` and redirect output — plain `&` blocks the Bash tool!
lsof -ti :4444 | xargs kill -9 2>/dev/null || true
npx http-server /tmp/annotation-workspace -p 4444 -c-1 --silent > /tmp/http-server.log 2>&1 & disown
sleep 2

# Screenshot with Playwright at 1280x720 viewport
# Navigate to http://localhost:4444/annotation.html and screenshot

# Clean up when done
lsof -ti :4444 | xargs kill -9 2>/dev/null || true
```

**GOTCHA**: `npx http-server ... &` (without `disown` and output redirection) will **block the Bash tool** and cause a timeout. This is the same issue as with `npx next start`. Always use: `command > /tmp/logfile 2>&1 & disown`

### 4. Store all screenshots

All screenshots (before + annotated after) go in a single directory:

```
public/changelog/<slug>/
```

This is the single source of truth. Changelog MDX entries and PR descriptions both reference these same images.

Naming convention:

- `before-<page>.png` — original state
- `after-<feature>.png` — annotated "after" screenshot

### 5. Embed in changelog and PR

**CRITICAL: NEVER include screenshots of demo-only UI in changelogs or PR descriptions.** The login screen (with DemoPlayer/DuoPartner/AdminUser buttons) is demo-mode infrastructure — real users authenticate via Discord OAuth and never see it. If a real user would never see the screen, it must not appear in the changelog. This also applies to any demo-specific labels, badges, or UI elements visible only in demo mode.

#### Changelog MDX

Use plain markdown image syntax (NOT `next/image` — `compileMDX` from `next-mdx-remote/rsc` doesn't support it):

```markdown
### Before

![Before review page](/changelog/review-flow-ux/before-review.png)

### After

![Collapsed cards with priority badge](/changelog/review-flow-ux/after-collapsed-cards.png)
```

Image styling is handled by `changelog-prose img` in `globals.css` (max-width, border-radius, margin).

#### PR description

Use GitHub raw image URLs pointing to the **commit SHA** (NOT the branch name):

```markdown
![Before](https://github.com/beagleknight/levelrise/blob/<commit-sha>/public/changelog/<slug>/before-review.png?raw=true)
```

**How to get the commit SHA**: After committing the screenshot files, run:

```bash
git rev-parse HEAD
```

Use the full 40-character SHA in the URL. This ensures the image URL is permanent — it survives branch deletion after the PR is merged.

**WARNING: Do NOT use branch names in image URLs.** Branch-based URLs (e.g., `.../blob/feat/my-feature/...`) break as soon as the branch is deleted after merge. Since all PRs are squash-merged and branches are deleted, every branch-based image URL will eventually return 404. Commit SHAs are immutable and permanent.

Do NOT use `raw.githubusercontent.com` URLs — they don't render reliably in PR descriptions.

## Dev server recipe (demo mode)

### Why demo mode?

The app requires Discord OAuth for login. Demo mode bypasses this with a "DemoPlayer" button on the login page, using seeded data in the local SQLite DB.

### Build and start

```bash
# 1. Kill any existing server on the port
lsof -ti :3777 | xargs kill -9 2>/dev/null || true

# 2. Build with demo mode enabled
NEXT_PUBLIC_DEMO_MODE=true npm run build

# 3. Start in background (CRITICAL: do NOT run in foreground — the tool will timeout)
NEXT_PUBLIC_DEMO_MODE=true \
  AUTH_SECRET=smoke-test-secret-at-least-32-characters \
  AUTH_TRUST_HOST=true \
  TURSO_DATABASE_URL=file:./data/levelrise.db \
  npx next start -p 3777 > /tmp/next-server.log 2>&1 & disown
sleep 4
cat /tmp/next-server.log
```

### Critical gotchas

1. **Must use production build** — `next dev` does NOT support demo mode login (different session handling).
2. **Login URL is `/login`** (NOT `/auth/login`). Click "DemoPlayer" button to authenticate.
3. **Port 3777** — avoid 3000 (might conflict with other dev servers).
4. **Background server** — always start with `& disown` and redirect output to a log file. Foreground execution causes tool timeouts.
5. **Kill before restart** — always kill the previous server process before starting a new one. Check with `lsof -ti :3777`.
6. **Seed data** — run `npm run db:seed` if the DB is empty or stale. The seed provides 50 matches, 3 coaching sessions, etc.

### Viewport and scroll

- **Resize to 1280x720** before taking screenshots (use `playwright_browser_resize`).
- **Full-page screenshots are too tall** — always use viewport-sized screenshots.
- **Auto-scroll workaround**: Some pages auto-scroll on load (e.g., the review page's `useEffect` scrolls the first expanded card into view). After navigation, run:
  ```js
  document.querySelector("h1").scrollIntoView({ behavior: "instant", block: "start" });
  ```
  to reset to the top of the page before screenshotting.

### Shutting down

```bash
lsof -ti :3777 | xargs kill -9 2>/dev/null || true
```

## CI pre-validation — MANDATORY

### The problem

Pushing code that fails CI wastes time in push-fix-push cycles. For UI/a11y changes, failures are often predictable and catchable locally.

### Rule 1: Format EVERY file you create or edit — IMMEDIATELY

The project uses `oxfmt` (NOT prettier). **Every file you write or edit must be formatted before committing.** This includes skill files, MDX changelogs, JSON, TypeScript — everything.

```bash
# Format a specific file after writing/editing it
npx oxfmt --write <file>

# Verify all source files pass (ignore .playwright-mcp/ — untracked)
npx oxfmt --check src/ messages/ changelog/ .opencode/
```

**CRITICAL**: Run `npx oxfmt --write <file>` immediately after writing or editing ANY file. Do not batch formatting — format each file as you go. This prevents format issues from accumulating and being forgotten.

The CI `Format` check runs `oxfmt --check .` which includes all tracked files. If you forget to format even one file, CI will fail.

### Rule 2: Run smoke tests locally before pushing

When a PR touches ANY of the following, run `npm run test:smoke` locally before pushing:

- Interactive components (buttons, forms, modals, dropdowns, accordions)
- ARIA attributes (`aria-label`, `aria-labelledby`, `role`, etc.)
- Color tokens or opacity values
- New pages or route changes
- Layout structure changes

```bash
npm run test:smoke
```

This runs the Playwright smoke suite, which includes axe-core a11y scans on all pages. It auto-builds and starts the server via `playwright.config.ts`'s `webServer` config, so no manual server management is needed.

### Rule 3: Run E2E tests locally when touching interactive flows

If the PR changes interactive flows that have E2E coverage (review flow, coaching flow, match detail), also run:

```bash
npm run test:e2e
```

### Full pre-push checklist for UI PRs

1. [ ] `npx oxfmt --write <file>` on every file you created or edited
2. [ ] `npx oxfmt --check src/ messages/ changelog/ .opencode/` — full format verification
3. [ ] `npm run lint` — lint rules including jsx-a11y
4. [ ] `npm run build` — compilation + type checking
5. [ ] `npm run test:smoke` — a11y violations, page loads
6. [ ] `npm run test:e2e` — if touching interactive flows with E2E coverage
7. [ ] All checks pass → safe to push

### Known CI-only issues

- **Flaky coaching E2E test** (`cycle action item status on session detail`) — tracked in issue #74. This test can fail on CI but is unrelated to most changes. If only this test fails, it's the known flake.
- **Sonner toaster a11y** — `toast.loading()` can produce low-contrast text. The toaster is excluded from axe scans via `.exclude('[data-sonner-toaster]')` in `tests/smoke/a11y.spec.ts`.

## Checklist for UI/UX PRs

1. [ ] "Before" screenshots captured BEFORE making changes
2. [ ] "After" screenshots captured and annotated with red arrows/labels
3. [ ] All images stored in `public/changelog/<slug>/`
4. [ ] **No demo-only UI in changelogs** — login screen, demo user buttons, seed data labels must NEVER appear
5. [ ] Changelog MDX (both `en/` and `es/`) includes embedded screenshots
6. [ ] PR description includes before/after images with commit SHA-based GitHub blob URLs (NOT branch names)
7. [ ] `npx oxfmt --write <file>` run on EVERY file created or edited
8. [ ] `npx oxfmt --check src/ messages/ changelog/ .opencode/` passes
9. [ ] `npm run test:smoke` passes locally before pushing
10. [ ] `npm run test:e2e` passes locally (if touching interactive flows)
11. [ ] Dev server shut down after screenshot session (`lsof -ti :3777 | xargs kill -9`)

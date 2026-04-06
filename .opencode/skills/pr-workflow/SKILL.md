---
name: pr-workflow
description: PR-based development workflow for lol-tracker. Use when implementing features, fixing bugs, or making any code changes. Covers branch creation, CI checks, changelog entries, and PR creation.
---

## What I do

Enforce the PR-based development workflow. All code changes go through pull requests — never push directly to main.

## When to use me

- Starting any implementation task (feature, bug fix, refactor, etc.)
- Creating a branch for new work
- Writing changelog entries for PRs
- Creating pull requests
- Checking CI status on PRs

## Critical rules

1. **NEVER commit to main.** NEVER push to main. All changes go through feature branches and PRs.
2. **ALWAYS check the current branch** before making any changes. If on `main`, create a feature branch first.
3. **Every PR must include a changelog entry** unless it's purely infrastructure (CI config, skill files, etc.) — in that case, add the `skip-changelog` label to the PR.

## Workflow

### 1. Start work — create a feature branch

```bash
# Always start from up-to-date main
git checkout main
git pull origin main
git checkout -b <branch-name>
```

Branch naming conventions:

- `feat/<short-description>` — new features
- `fix/<short-description>` — bug fixes
- `refactor/<short-description>` — refactoring
- `chore/<short-description>` — infrastructure, CI, deps, etc.

### 2. Implement the changes

- Make commits on the feature branch
- **Formatting and linting are enforced automatically by a lefthook pre-commit hook** — `oxfmt --check` and `oxlint` run on staged files at commit time. If they fail, the commit is rejected. Fix formatting with `npm run fmt` and re-commit. You do NOT need to run `fmt:check` or `lint` manually before pushing — the hook handles it.
- **MANDATORY: Run `npm run build` locally before every push.** Do NOT rely on CI as the first build check — catch errors locally. `npm run build` implicitly runs `tsc`, so a separate `npm run typecheck` is not required.
- **MANDATORY: Run smoke tests locally before pushing when the PR touches UI.** Any change to components, styles, color tokens, ARIA attributes, layouts, or pages requires smoke tests to pass locally:
  ```bash
  npm run test:smoke
  ```
  This catches a11y violations (axe-core WCAG 2.1 AA scans), broken pages, and contrast failures that would otherwise only be caught in CI.
- **MANDATORY: Run E2E tests locally before pushing when the PR touches interactive flows.** If the PR modifies interactive user flows that have E2E coverage (review, coaching, match detail, etc.):
  ```bash
  npm run test:e2e
  ```
- **MANDATORY: Verify the lockfile before every push** (when `package-lock.json` is staged). Run `npm ci` to confirm the lockfile is consistent. If it fails, regenerate with `npm install`. The canonical Node version is defined in `.tool-versions` — both local dev and CI use the same version.

### 3. Write a changelog entry

Create MDX files in **both** locale directories:

```
changelog/en/YYYY-MM-DD-slug.mdx
changelog/es/YYYY-MM-DD-slug.mdx
```

Frontmatter format:

```yaml
---
version: "YYYY.MM.N"
date: "YYYY-MM-DD"
title: "Human-readable title"
tags: ["feature"]
---
```

Body uses standard Markdown: **bold**, lists, `### headings`.

#### Image layout rules

**MANDATORY: When a changelog includes two or more related images (before/after pairs, sequential steps, side-by-side comparisons), they MUST be wrapped in the 2-column grid layout.** No exceptions.

```mdx
<div className="changelog-image-grid">

![Before: description of the old state](/changelog/slug/before-image.png)

![After: description of the new state](/changelog/slug/after-image.png)

</div>
```

Rules:

1. **Always use the grid** for any pair of related images — before/after, step 1/step 2, old/new
2. **Always write descriptive alt text** — it renders as a visible caption (`<figcaption>`) below each image. Good: `"Before: flat list of all players"`. Bad: `"screenshot"`.
3. **Blank lines are required** between the `<div>` tags and the images — MDX needs them to parse the Markdown image syntax
4. Single standalone images (not part of a pair) can appear inline without the grid
5. Do NOT use separate `### Before` / `### After` headings with images underneath — use the grid instead

#### Audience and tone

The audience is **League of Legends players** who want to know what changed. Not developers, not designers. Write like you're telling a friend what's new. Casual, direct, no jargon. Talk about what changed **in their experience**, not how it was built.

**Forbidden terms** (never use in changelog body or title):

- Web/dev technology: API, HTTP, HTML, CSS, SSE, REST, JSON, webhook, endpoint, route, middleware, query parameter, cookie, hook, component, refactor, payload, cache (as a noun), i18n, locale, lightbox, monospace, em-dash, CalVer, WCAG, ARIA, axe-core, contrast ratio, semantic, token
- Infrastructure: Vercel, Turso, SQLite, Drizzle, Next.js, React, server action, server component, RSC, CDN, deploy, build, CI
- If a player wouldn't understand a term without googling it, don't use it.

**Rephrase guide:**

| Instead of                   | Write                                                     |
| ---------------------------- | --------------------------------------------------------- |
| "Riot API"                   | "your match data from Riot" or "synced from your account" |
| "batched sync"               | "matches sync in smaller chunks so nothing gets lost"     |
| "cookie triggers sync"       | (just don't mention it)                                   |
| "lightbox"                   | "image zoom"                                              |
| "WCAG 2.1 AA compliance"     | "readable and usable for everyone"                        |
| "refactored the sync system" | "match syncing is now more reliable"                      |
| "i18n files updated"         | (skip, internal detail)                                   |
| "query parameter"            | (describe the user-visible effect instead)                |

**Changelog litmus test — MANDATORY.** Before writing any changelog, ask: _"Would a League of Legends player notice this change during normal use without being told about it?"_ If no, use `skip-changelog`.

**Examples that PASS the test** (need a changelog):

- Duo partner picker redesigned → player interacts with it directly
- New onboarding wizard → every new player goes through it
- Match cards show role icons → visible on every match

**Examples that FAIL the test** (use `skip-changelog`):

- Rate limiter / sync queue → invisible plumbing, players just see "syncing"
- Admin dashboard / user management → only the admin sees it, not players
- Invite expiration logic → players just use a code that works or doesn't
- CI config, linting rules, skill file updates → purely internal
- Dependency bumps, code style changes, variable renames → purely internal
- Database migrations with no UI change → invisible to players

**Litmus test — MANDATORY before writing any changelog entry:** Ask yourself: _"Would a League of Legends player notice this change during normal use without being told about it?"_ If the answer is no, use `skip-changelog`. This test catches the most common mistake: writing changelogs for infrastructure that only surfaces as internal status messages, error prevention, or performance improvements under load. Examples that **fail** the litmus test (use `skip-changelog`): rate limiters, sync queues, database migrations, caching layers, CI config, internal error handling, monitoring. Examples that **pass** the litmus test (write a changelog): new search UI, redesigned match cards, new coaching feature, bug fix where matches weren't loading.

Version scheme — **CalVer** (`YYYY.MM.N`):

- `YYYY` = calendar year (e.g. 2026)
- `MM` = calendar month, zero-padded (e.g. 03)
- `N` = sequential release number within that month, starting at 1

To determine the next version, check the latest `version` in `changelog/en/` files and increment `N`. If the month changed, reset `N` to 1.

Available tags: `feature` (new capability), `fix` (bug fix), `improvement` (enhancement to existing feature). Every entry must have at least one tag. Internal-only changes (CI, refactors, config) should use the `skip-changelog` label instead.

Also update `package.json` `version` to match the latest CalVer version.

If the PR is purely infrastructure (CI, skills, config) and has no user-facing changes, skip the changelog and add the `skip-changelog` label to the PR instead.

### 4. Push and create PR

```bash
git push -u origin <branch-name>
```

Create the PR with `gh pr create`. The PR body should follow this format:

```markdown
## Summary

- Brief description of changes

Fixes #N

<!-- Use "Fixes #N" for each GitHub issue this PR resolves. -->
<!-- GitHub auto-closes the issue when the PR merges. -->
<!-- Use "Relates to #N" if the PR partially addresses but doesn't fully close an issue. -->

## Changelog

- Version YYYY.MM.N: <what changed for users>
```

**Issue linking is mandatory.** Before creating a PR, check `gh issue list` for related issues. If the PR resolves one or more issues, include `Fixes #N` (one per line) in the PR body. If it partially addresses an issue, use `Relates to #N` instead.

### 5. CI checks

Seven checks run automatically on every PR to `main`:

| Check             | Command                           | What it catches                                               |
| ----------------- | --------------------------------- | ------------------------------------------------------------- |
| **Typecheck**     | `tsc --noEmit`                    | Type errors                                                   |
| **Lint**          | `oxlint`                          | Code quality, unused vars, React rules, jsx-a11y, TypeScript  |
| **Format**        | `oxfmt --check .`                 | Formatting consistency (import sorting, Tailwind class order) |
| **Migration**     | `tsx scripts/test-migration.ts`   | Migrations that break pre-existing data                       |
| **Build**         | `next build --webpack`            | Compilation errors, broken imports                            |
| **Smoke**         | `playwright test --project=smoke` | Axe-core a11y violations on every page, data integrity        |
| **E2E**           | `playwright test --project=e2e`   | End-to-end user flows                                         |
| **Changelog**     | `git diff` on `changelog/`        | Missing changelog entry (skipped with `skip-changelog` label) |

All checks must pass before merging.

### 6. Merge

**MANDATORY: NEVER merge a PR without the user's explicit permission.** Even if the user says "proceed" or "do it", that means implement + push — NOT merge. Only merge when the user explicitly says "merge it" (or equivalent).

**MANDATORY: Wait for CI checks to pass BEFORE merging.** Even after receiving merge permission, always confirm all checks pass first:

```bash
gh pr checks <number> --watch
```

After the user grants permission AND CI passes, merge the PR via GitHub (squash merge preferred for clean history).

Vercel auto-deploys on merge to main — no manual deploy step needed.

### 7. Flaky tests

**MANDATORY: Flaky tests are unacceptable.** Whenever a CI check passes only on re-run (i.e., a test is flaky), immediately open a GitHub issue with the `flaky-test` label. The issue should describe:

- Which test flaked (full test name)
- What the failure looked like (error message / timeout)
- In which PR/run it was observed (link to the CI run)

Do this even if the overall CI run eventually passes on retry. Flaky tests erode trust in the test suite and must be tracked and fixed.

## Common scenarios

### Quick fix (1 commit)

```bash
git checkout main && git pull
git checkout -b fix/description
# make changes
npm run build
npm run test:smoke  # if touching UI/styles/a11y
git add -A && git commit -m "fix: description"  # lefthook checks fmt + lint
# add changelog entry
git add -A && git commit -m "docs: add changelog entry"
git push -u origin fix/description
gh pr create --title "fix: description" --body "..."
```

### Feature (multiple commits)

```bash
git checkout main && git pull
git checkout -b feat/description
# implement in logical commits (lefthook checks fmt + lint on each commit)
npm run build
npm run test:smoke  # if touching UI/styles/a11y
npm run test:e2e    # if touching interactive flows
# add changelog at the end
git push -u origin feat/description
gh pr create --title "feat: description" --body "..."
```

### Infrastructure change (no changelog)

```bash
git checkout main && git pull
git checkout -b chore/description
# make changes
npm run build
git push -u origin chore/description
gh pr create --title "chore: description" --body "..." --label skip-changelog
```

### PR includes migration files (`drizzle/*.sql`)

**MANDATORY checklist** — complete ALL items before pushing:

1. **Data migration review**: Does the migration create a new table or add an FK column? If yes, does it include `INSERT INTO ... SELECT FROM` (or `UPDATE ... SET`) to populate it from existing data? A `CREATE TABLE` without data migration is a production outage.
2. **Validation file**: Write a `drizzle/XXXX_name.validate.sql` companion file with queries that return 0 rows when data is correct. The migration runner (`scripts/migrate.ts`) executes these automatically after applying each migration.
3. **Migration integration test**: Run `npm run test:migration` to verify migrations handle pre-existing data correctly. This test applies migrations in two phases (before/after a split point), inserting fixture data in between.
4. **Seed script independence**: The seed script (`scripts/seed.ts`) must NOT compensate for missing migration logic. If the seed creates data for a new table, the migration must also create that data for existing production rows.
5. **Mental production test**: Imagine running this migration against a production database with real users. User logs in → navigates to dashboard → sees their data. If any step breaks, the migration is incomplete.

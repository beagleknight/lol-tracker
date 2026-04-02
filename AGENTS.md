<!-- BEGIN:pr-workflow-rules -->

# PR-based workflow — MANDATORY

**NEVER commit to `main`. NEVER push to `main`.** All changes go through feature branches and pull requests.

Before making ANY code change:

1. Run `git branch --show-current` to check the current branch
2. If on `main`, create a feature branch first: `git checkout -b feat/description` (or `fix/`, `refactor/`, `chore/`)
3. If already on a feature branch, proceed

Every PR must include a changelog entry (`changelog/en/*.mdx` + `changelog/es/*.mdx`) unless it's infrastructure-only — in that case add the `skip-changelog` label. **Litmus test:** "Would a League of Legends player notice this change during normal use without being told about it?" If not, use `skip-changelog`.

**MANDATORY: Changelog images must use the 2-column grid layout.** When a changelog includes two or more related images (before/after, sequential steps), wrap them in `<div className="changelog-image-grid">`. Always write descriptive alt text — it renders as a visible caption. Do NOT use separate `### Before` / `### After` headings. See the `pr-workflow` skill for the exact template.

**Formatting and linting are enforced automatically by a lefthook pre-commit hook** — `oxfmt --check` and `oxlint` run on staged files at commit time. If they fail, the commit is rejected. Fix formatting with `npm run fmt` and re-commit. You do NOT need to run `fmt:check` or `lint` manually before pushing — the hook handles it.

**MANDATORY: Run `npm run build` locally BEFORE pushing.** Do not rely on CI as the first build check — catch errors locally first.

**MANDATORY: Run `npm run test:smoke` locally BEFORE pushing when the PR touches UI.** Any change to components, styles, color tokens, ARIA attributes, layouts, or pages requires smoke tests to pass locally. This catches a11y violations (color-contrast, missing labels, etc.) that would otherwise only fail in CI. Do NOT skip this step — pushing code that fails smoke tests wastes a CI round-trip.

**MANDATORY: Run `npm run test:e2e` locally BEFORE pushing when the PR touches interactive flows.** If the PR modifies user flows that have E2E coverage (review, coaching, match detail, etc.), run E2E tests locally first.

**MANDATORY: Wait for CI checks to pass BEFORE merging a PR.** Even if checks are not required by branch protection, always run `gh pr checks <number> --watch` (or poll) and confirm all checks pass before merging.

**MANDATORY: NEVER merge a PR without the user's explicit permission.** Even if the user says "proceed" or "do it", that means implement + push — NOT merge. Only merge when the user explicitly says "merge it" (or equivalent). If the user grants permission to merge, verify CI checks are green first.

**MANDATORY: Flaky tests are unacceptable.** Whenever a CI check passes only on re-run (i.e., a test is flaky), immediately open a GitHub issue labeled `flaky-test` describing which test flaked, what the failure looked like, and in which PR/run it was observed. Do this even if the overall CI run eventually passes. Flaky tests must be tracked and fixed.

Full workflow details are in the `pr-workflow` OpenCode skill.

<!-- END:pr-workflow-rules -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:turso-migration-rules -->

# Turso migration workflow

Migrations are **auto-applied on every Vercel deploy** via `scripts/migrate.ts` (runs before `next build` in `vercel.json`'s `buildCommand`). You do NOT need to apply migrations manually before pushing.

Steps after any schema change:

1. `npx drizzle-kit generate` — generates SQL in `drizzle/`
2. Review the generated SQL
3. Apply locally: `sqlite3 ./data/lol-tracker.db < drizzle/XXXX_*.sql` (or `npx drizzle-kit push` if it works)
4. Commit the migration files alongside your code — they will be applied to production automatically on deploy

Full workflow details are in the `vercel-turso-deploy` OpenCode skill.

<!-- END:turso-migration-rules -->

<!-- BEGIN:env-safety-rules -->

# Environment variable safety — MANDATORY

**`.env.local` is for LOCAL DEV ONLY.** It must NEVER contain production or preview credentials (Turso URLs, auth tokens, API keys for remote services).

Rules:

1. **NEVER run `vercel env pull` into `.env.local`** — it dumps production secrets. If you need remote credentials for a one-off task, pull into a temporary file (e.g., `.env.tmp`), use it, and delete it immediately.
2. **NEVER set `TURSO_DATABASE_URL` in `.env.local`** — local dev defaults to `file:./data/lol-tracker.db` (SQLite). This is intentional.
3. **To target a remote DB**, pass env vars explicitly inline: `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:seed -- --force-remote`
4. **Before running ANY script that writes to a database**, verify the target URL. If it contains `turso.io` or any remote host, STOP and confirm with the user.
5. **The seed script (`npm run db:seed`) refuses to run against remote databases** unless `--force-remote` is passed. This is a safety net — respect it.
6. **`db:push` and `db:pull` require explicit env vars** — they do NOT load `.env.local`. Pass credentials inline.

Environment strategy:

- Local dev → `.env.local` (dev-safe defaults, no remote DB, demo mode enabled)
- Preview → Vercel dashboard (Preview scope only)
- Production → Vercel dashboard (Production scope only)
<!-- END:env-safety-rules -->

<!-- BEGIN:lockfile-safety-rules -->

# Lockfile safety — MANDATORY before every push

The canonical Node.js version is defined in `.tool-versions` (currently Node 24). Both local dev and CI use the same version, so lockfile mismatches should not occur.

**Pre-push checklist** (when `package-lock.json` is staged):

1. Run `npm ci` to verify the lockfile is consistent. If it fails, regenerate with `npm install`.
2. Do NOT commit a lockfile generated by a different Node/npm version than the one in `.tool-versions`.
<!-- END:lockfile-safety-rules -->

<!-- BEGIN:task-completion-rules -->

# Task completion workflow

When executing a multi-step plan (e.g., the user says "proceed" or "do it"), **always include committing and pushing as the final steps in the todo list**. The user expects code changes to be deployed — don't stop at "build passes".

Final todos should be:

1. ... (all implementation steps)
2. Commit changes with a descriptive message
3. Push to remote
<!-- END:task-completion-rules -->

<!-- BEGIN:github-issues-rules -->

# GitHub Issues tracking

All tasks, features, and bugs are tracked as **GitHub Issues** (not a local TODO file). Use `gh issue list` at the start of every session to understand what's open.

**Issue linking in PRs is mandatory.** Before creating any PR:

1. Check `gh issue list` for related issues
2. If the PR fully resolves an issue, include `Fixes #N` in the PR body (one per line for multiple issues)
3. If the PR partially addresses an issue, use `Relates to #N` instead
4. GitHub auto-closes issues linked with `Fixes` when the PR merges

Reference issues in commit messages when relevant.

Full PR conventions are in the `pr-workflow` OpenCode skill.

<!-- END:github-issues-rules -->

<!-- BEGIN:i18n-aria-rules -->

# i18n + accessibility — MANDATORY

**Every `aria-label={t("key")}` requires translation keys in BOTH `messages/en.json` AND `messages/es.json`.** Missing keys crash the app at runtime. This is the most commonly forgotten step when fixing accessibility violations.

Before committing any file that adds a new `t()` call:

1. Identify the namespace (from `useTranslations("Namespace")`)
2. Add the key to `messages/en.json` under that namespace
3. Add the Spanish translation to `messages/es.json` under the same namespace
4. Verify with `npm run build` — the type system catches missing keys at build time

**All UI copy MUST use sentence case.** Only the first word and proper nouns/acronyms are capitalized. No Title Case anywhere — not in i18n values, hardcoded strings, or changelog titles. See the `i18n` skill for the full list of preserved proper nouns and acronyms.

<!-- END:i18n-aria-rules -->

<!-- BEGIN:ui-screenshots-rules -->

# UI/UX PRs require screenshots — MANDATORY

**BEFORE writing ANY code**, determine whether the task will change UI or UX. If it will — even partially — you MUST immediately load the `ui-screenshots` skill and capture "before" screenshots BEFORE touching any files. This is non-negotiable. Skipping this step means you lose the ability to capture the original state.

**Trigger condition**: The task mentions ANY of: components, pages, styles, layout, icons, badges, cards, colors, opacity, visual treatment, position display, tooltips, dropdowns, modals, or any user-visible change. When in doubt, load the skill — it's cheap to load and expensive to forget.

**MANDATORY first step for UI tasks**: `skill("ui-screenshots")` → capture "before" → then start coding.

Checklist for any PR touching UI:

1. **Load the `ui-screenshots` skill BEFORE making code changes** — this is step ZERO, before any planning
2. Capture "before" screenshots of affected pages/components
3. Implement the changes
4. Capture "after" screenshots and annotate them (red arrows/labels)
5. Store all images in `public/changelog/<slug>/`
6. Embed screenshots in both the PR description and changelog MDX entries
7. Use the demo-mode production server recipe from the skill for captures

If you forgot to capture "before" screenshots, check out `main`, capture them, then switch back to the feature branch.

Full workflow details are in the `ui-screenshots` OpenCode skill.

<!-- END:ui-screenshots-rules -->

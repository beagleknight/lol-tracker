<!-- BEGIN:pr-workflow-rules -->
# PR-based workflow — MANDATORY

**NEVER commit to `main`. NEVER push to `main`.** All changes go through feature branches and pull requests.

Before making ANY code change:
1. Run `git branch --show-current` to check the current branch
2. If on `main`, create a feature branch first: `git checkout -b feat/description` (or `fix/`, `refactor/`, `chore/`)
3. If already on a feature branch, proceed

Every PR must include a changelog entry (`changelog/en/*.mdx` + `changelog/es/*.mdx`) unless it's infrastructure-only — in that case add the `skip-changelog` label.

**MANDATORY: Run `npm run lint` and `npm run build` locally BEFORE pushing.** Do not rely on CI as the first lint/build check — catch errors locally first.

**MANDATORY: Wait for CI checks to pass BEFORE merging a PR.** Even if checks are not required by branch protection, always run `gh pr checks <number> --watch` (or poll) and confirm all checks pass before merging.

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
# Lockfile safety — MANDATORY before every commit

**NEVER commit a modified `package-lock.json` without verifying it.** Local Node/npm version mismatches (e.g., Node 24 locally vs Node 22 in CI) can silently prune or add entries, causing `npm ci` to fail in CI.

Before committing, if `package-lock.json` is staged:
1. Check whether you actually changed dependencies in `package.json`. If not, **restore the lockfile from main**: `git checkout origin/main -- package-lock.json`
2. If you did change dependencies, regenerate the lockfile with the CI Node version in mind. Verify with `npm ci` locally.
3. Never blindly commit lockfile changes from `npm install` — they may reflect your local Node version, not CI's.
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

<!-- BEGIN:pr-workflow-rules -->
# PR-based workflow — MANDATORY

**NEVER commit to `main`. NEVER push to `main`.** All changes go through feature branches and pull requests.

Before making ANY code change:
1. Run `git branch --show-current` to check the current branch
2. If on `main`, create a feature branch first: `git checkout -b feat/description` (or `fix/`, `refactor/`, `chore/`)
3. If already on a feature branch, proceed

Every PR must include a changelog entry (`changelog/en/*.mdx` + `changelog/es/*.mdx`) unless it's infrastructure-only — in that case add the `skip-changelog` label.

Full workflow details are in the `pr-workflow` OpenCode skill.
<!-- END:pr-workflow-rules -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:turso-migration-rules -->
# Turso migration reminder

**Run migrations against production Turso BEFORE pushing code that references new schema.** Vercel does NOT run migrations on deploy.

Steps: `npx drizzle-kit generate` -> review SQL -> apply via standalone script (see `vercel-turso-deploy` skill — `drizzle-kit migrate` does NOT work with dotenvx) -> verify -> push code.

Full workflow details are in the `vercel-turso-deploy` OpenCode skill.
<!-- END:turso-migration-rules -->

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

When a PR resolves an issue, include `Fixes #N` in the PR description to auto-close it on merge. Reference issues in commit messages when relevant.

Full conventions are in the `todo-tracking` OpenCode skill.
<!-- END:github-issues-rules -->

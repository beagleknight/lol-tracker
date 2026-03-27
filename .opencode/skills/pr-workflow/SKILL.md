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
- **MANDATORY: Run lint and build locally before every push.** Do NOT rely on CI as the first lint check — catch errors locally:
  ```bash
  npm run lint
  npm run build
  ```
  Fix any errors before committing/pushing. Warnings from pre-existing code are acceptable, but new warnings from your changes should be fixed.
- `npm run build` implicitly runs `tsc`, so a separate `npm run typecheck` is not required.
- **MANDATORY: Verify the lockfile before every push.** Local Node 24 / npm 11 generates lockfiles incompatible with CI's Node 22 / npm 10. Always run:
  ```bash
  npx -y npm@10 ci
  ```
  If this fails, regenerate the lockfile:
  ```bash
  git checkout origin/main -- package-lock.json
  npx -y npm@10 install --package-lock-only
  npx -y npm@10 ci   # verify it works now
  ```
  If you did NOT change `package.json` dependencies, just restore the lockfile from main:
  ```bash
  git checkout origin/main -- package-lock.json
  ```

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

Version scheme — **CalVer** (`YYYY.MM.N`):
- `YYYY` = calendar year (e.g. 2026)
- `MM` = calendar month, zero-padded (e.g. 03)
- `N` = sequential release number within that month, starting at 1

To determine the next version, check the latest `version` in `changelog/en/` files and increment `N`. If the month changed, reset `N` to 1.

Available tags: `feature`, `fix`, `improvement`, `refactor`. Every entry must have at least one tag.

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

Six checks run automatically on every PR to `main`:

| Check | Command | What it catches |
|---|---|---|
| **Typecheck** | `tsc --noEmit` | Type errors |
| **Lint** | `eslint` | Code style, unused vars, React rules, jsx-a11y |
| **Build** | `next build --webpack` | Compilation errors, broken imports |
| **Smoke** | `playwright test --project=smoke` | Axe-core a11y violations on every page |
| **E2E** | `playwright test --project=e2e` | End-to-end user flows |
| **Changelog** | `git diff` on `changelog/` | Missing changelog entry (skipped with `skip-changelog` label) |

All six must pass before merging.

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
npm run lint && npm run build
git add -A && git commit -m "fix: description"
# add changelog entry
git add -A && git commit -m "docs: add changelog entry"
git push -u origin fix/description
gh pr create --title "fix: description" --body "..."
```

### Feature (multiple commits)
```bash
git checkout main && git pull
git checkout -b feat/description
# implement in logical commits
npm run lint && npm run build
# add changelog at the end
git push -u origin feat/description
gh pr create --title "feat: description" --body "..."
```

### Infrastructure change (no changelog)
```bash
git checkout main && git pull
git checkout -b chore/description
# make changes
npm run lint && npm run build
git push -u origin chore/description
gh pr create --title "chore: description" --body "..." --label skip-changelog
```

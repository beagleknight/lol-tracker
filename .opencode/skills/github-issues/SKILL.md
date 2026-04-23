---
name: github-issues
description: Write clear, public-facing GitHub issues for an open-source project. Covers title conventions, body templates, label selection, and mandatory safety checks to prevent leaking sensitive information.
---

## What I do

Guide writing GitHub issues that are safe for a public open-source repository, well-structured, and actionable for external contributors.

## When to use me

- Creating any GitHub issue
- Triaging or refining existing issues
- Batch-creating issues from a planning session

## Open-source safety checklist — MANDATORY

**Before creating or editing ANY issue, verify the body does NOT contain:**

1. **Credentials or tokens** — API keys, auth tokens, env var VALUES (referencing env var NAMES like `RIOT_API_KEY` is fine)
2. **Internal URLs** — Vercel dashboard links, Turso console URLs, admin panel paths, preview deployment URLs with sensitive context
3. **Security vulnerability details** — if the issue describes an exploitable flaw, use [GitHub private security advisories](https://docs.github.com/en/code-security/security-advisories) instead
4. **User PII** — real player names, email addresses, Discord IDs, Riot PUUIDs tied to real people
5. **Deployment specifics** — Vercel project IDs, database region/cluster names, build secrets, internal infrastructure topology
6. **Private business decisions** — revenue numbers, user counts, internal roadmap priorities not meant for public consumption

### Safe to include

- Env var **names** (e.g., `RIOT_API_KEY`, `AUTH_DISCORD_ID`) without values
- Public API endpoint paths (e.g., `/riot/account/v1/accounts/by-riot-id/...`)
- DDragon URLs and version strings
- Error messages with sensitive data redacted
- File paths within the repository
- CI run links (these are public on public repos)

## Title format

```
<prefix>: <concise description in lowercase>
```

**Always use lowercase for the prefix and description.** Only capitalize proper nouns (e.g., "Riot", "GDPR", "Discord").

### Prefixes

| Prefix      | Use when                                     |
| ----------- | -------------------------------------------- |
| `bug:`      | Something is broken or behaving incorrectly  |
| `feat:`     | New user-facing functionality                |
| `ux:`       | UX/UI improvement to existing functionality  |
| `perf:`     | Performance optimization                     |
| `refactor:` | Code cleanup with no behavior change         |
| `chore:`    | Infrastructure, CI, deps, tooling            |
| `docs:`     | Documentation changes                        |
| `a11y:`     | Accessibility improvement                    |
| `i18n:`     | Internationalization / localization          |
| `legal:`    | Compliance, privacy policy, terms of service |
| `planning:` | Decision tracking, research, strategy        |

### Title examples

- `bug: rank labels missing space in analytics chart axis`
- `feat: add privacy policy page`
- `ux: sidebar has no loading skeleton on slow networks`
- `perf: sidebar prefetches all routes including low-priority pages`
- `legal: implement GDPR data deletion handling`
- `planning: apply for Riot production API key`

## Body structure

Use the structure that matches the issue type. All issues should be understandable by an external contributor who has read the README but hasn't studied the full codebase.

### Bug

```markdown
## Description

What's broken. Be specific — include the page/component and the incorrect behavior.

## Steps to reproduce

1. Go to '...'
2. Click on '...'
3. See error

## Expected behavior

What should happen instead.

## Actual behavior

What actually happens.

## Environment (if relevant)

- Browser: (e.g., Chrome 125)
- OS: (e.g., Windows 11)
- Locale: (e.g., en, es)
```

### Feature / Enhancement

```markdown
## Problem statement

What problem does this solve? Why does it matter for users?

## Proposed solution

How should it work from the user's perspective? Include mockups or examples if helpful.

## Alternatives considered

Other approaches that were evaluated and why they were rejected.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
```

### Planning / Decision

```markdown
## Context

Background information. Why is this decision needed now?

## Options

### Option A: ...

- Pros: ...
- Cons: ...

### Option B: ...

- Pros: ...
- Cons: ...

## Decision criteria

What factors matter most for this decision?

## Next steps

What needs to happen after the decision is made?
```

### Legal / Compliance

```markdown
## Requirement

What policy, law, or regulation requires this? Link to the source.

## Current state

What exists today? What's missing?

## Action needed

Specific changes required to achieve compliance.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by / Depends on

List any dependencies on other issues.
```

## Labels

Use existing repository labels. An issue should have 1-3 labels. Common combinations:

| Issue type        | Primary label               | Optional secondary                     |
| ----------------- | --------------------------- | -------------------------------------- |
| Bug               | `bug`                       | `i18n`, `accessibility`, `performance` |
| Feature           | `feature` or `enhancement`  | `ui/ux`, `i18n`, `accessibility`       |
| UX improvement    | `polish` or `ui/ux`         | `accessibility`                        |
| Performance       | `performance`               | —                                      |
| Infrastructure    | `infra` or `infrastructure` | `dx`                                   |
| Accessibility     | `accessibility`             | `polish`                               |
| Planning/decision | `future`                    | `go-public`                            |
| Legal/compliance  | `documentation`             | `go-public`                            |
| Flaky test        | `flaky-test`                | —                                      |

### Special labels

- **`go-public`** — blocks making the repo fully public or applying for external services (e.g., Riot production API key)
- **`epic`** — large initiative that will be broken into sub-issues
- **`good first issue`** — suitable for new contributors; requires clear description and limited scope
- **`skip-changelog`** — used on PRs, not issues

## Issue linking

Use these patterns in issue bodies to express relationships:

- `Blocked by #N` — this issue cannot start until #N is resolved
- `Depends on #N` — same as blocked by (use either consistently)
- `Relates to #N` — related but not blocking
- `Supersedes #N` — this issue replaces an older one

PRs that resolve issues use `Fixes #N` in the PR body (not in the issue itself).

## Acceptance criteria guidelines

Include acceptance criteria when:

- The issue involves implementing something (feature, fix, legal requirement)
- An external contributor might pick it up and needs to know "what does done look like"

Skip acceptance criteria when:

- The issue is a planning/decision discussion
- The issue is exploratory research

Format as a task list:

```markdown
## Acceptance criteria

- [ ] Privacy policy page accessible at /legal/privacy
- [ ] Covers data collection, storage, retention, and deletion
- [ ] Available in both English and Spanish
```

## What NOT to put in issues — examples

| Bad (don't write this)                         | Good (write this instead)                                 |
| ---------------------------------------------- | --------------------------------------------------------- |
| `RIOT_API_KEY=RGAPI-xxxx-...`                  | `the RIOT_API_KEY env var`                                |
| `https://vercel.com/team/lol-tracker/settings` | `the Vercel project settings`                             |
| `Database is in dub1 region`                   | `the database region` (or omit if irrelevant)             |
| `User david.morcillo@gmail.com reported...`    | `a user reported...`                                      |
| `The admin panel at /admin/users shows...`     | (use a private security advisory if it's a vulnerability) |
| `We have 47 registered users`                  | (omit — internal metric)                                  |

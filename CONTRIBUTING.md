# Contributing to LevelRise

## Getting started

### Prerequisites

- Node.js 24+ (recommended: use `fnm` with the included `.tool-versions`)
- A Discord application for OAuth login
- A Riot Games API key (development key from [developer.riotgames.com](https://developer.riotgames.com))

### Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and fill in your values (see [environment variables](#environment-variables) below)
4. Set up Discord OAuth redirect (see [Discord OAuth setup](#discord-oauth-setup) below)
5. Create the data directory and push the schema: `mkdir data && npx drizzle-kit push`
6. Run the dev server: `npm run dev`
7. Open [http://localhost:3000](http://localhost:3000)

### Environment variables

Copy `.env.example` to `.env.local` and fill in the required values:

| Variable                       | Required | Where to get it                                                                   |
| ------------------------------ | -------- | --------------------------------------------------------------------------------- |
| `AUTH_SECRET`                  | Yes      | Generate with `npx auth secret`                                                   |
| `AUTH_DISCORD_ID`              | Yes      | [Discord Developer Portal](https://discord.com/developers/applications)           |
| `AUTH_DISCORD_SECRET`          | Yes      | Discord Developer Portal                                                          |
| `RIOT_API_KEY`                 | Yes      | [developer.riotgames.com](https://developer.riotgames.com)                        |
| `GOOGLE_GENERATIVE_AI_API_KEY` | No       | [Google AI Studio](https://aistudio.google.com/apikey) (for AI coaching features) |
| `TURSO_DATABASE_URL`           | No       | Defaults to local SQLite file (`file:./data/levelrise.db`)                        |
| `TURSO_AUTH_TOKEN`             | No       | Only needed for remote Turso databases                                            |

See `.env.example` for the full list with documentation.

### Discord OAuth setup

1. Create a new application at [discord.com/developers](https://discord.com/developers/applications)
2. Go to **OAuth2 > Redirects** and add: `http://localhost:3000/api/auth/callback/discord`
3. Copy the **Client ID** and **Client Secret** into your `.env.local` as `AUTH_DISCORD_ID` and `AUTH_DISCORD_SECRET`

### Demo mode (no credentials needed)

If you want to skip Discord and Riot API setup entirely, you can run in demo mode:

1. Set `NEXT_PUBLIC_DEMO_MODE=true` in `.env.local`
2. Seed the database: `npm run db:seed`
3. Start the dev server: `npm run dev`

Demo mode uses fake auth (no Discord OAuth) and mocked Riot API data. The login page shows a user picker instead of Discord sign-in.

## Available scripts

| Command                    | Description                                    |
| -------------------------- | ---------------------------------------------- |
| `npm run dev`              | Start dev server                               |
| `npm run build`            | Production build                               |
| `npm run start`            | Start production server                        |
| `npm run fmt`              | Fix formatting issues                          |
| `npm run test:smoke`       | Run Playwright smoke tests (a11y + pages)      |
| `npm run test:e2e`         | Run Playwright end-to-end tests                |
| `npm run test:migration`   | Test database migrations against existing data |
| `npm run db:seed`          | Seed the database with demo data               |
| `npx drizzle-kit push`     | Push schema changes to the database            |
| `npx drizzle-kit generate` | Generate migration SQL from schema changes     |
| `npx drizzle-kit studio`   | Open Drizzle Studio to browse the database     |

### Build notes

- The production build uses the `--webpack` flag (`next build --webpack`) because Turbopack has issues bundling `@libsql/client`.

## Development workflow

### Branch naming

All changes go through pull requests — never push directly to `main`.

- `feat/short-description` — new features
- `fix/short-description` — bug fixes
- `refactor/short-description` — refactoring
- `chore/short-description` — infrastructure, CI, dependencies

### Making changes

1. Create a branch from up-to-date `main`
2. Implement your changes
3. Run `npm run build` before pushing (catches type errors and build issues)
4. Run `npm run test:smoke` if your changes touch UI, styles, or accessibility
5. Run `npm run test:e2e` if your changes touch interactive user flows
6. Push and open a pull request

### Code style

Formatting and linting are enforced automatically by pre-commit hooks (lefthook):

- **Formatting**: `oxfmt` (not Prettier)
- **Linting**: `oxlint` (not ESLint)

You don't need to configure anything — just commit and the hooks will check your code. If they fail, run `npm run fmt` and try again.

### Internationalization (i18n)

The app supports English and Spanish. If your changes add or modify user-facing text:

- Add keys to both `messages/en.json` and `messages/es.json`
- Use the `t()` function from `next-intl` (not hardcoded strings)
- All UI copy uses sentence case (only capitalize the first word and proper nouns)

### Changelog entries

Every user-facing PR needs a changelog entry in both:

- `changelog/en/YYYY-MM-DD-slug.mdx`
- `changelog/es/YYYY-MM-DD-slug.mdx`

Infrastructure-only PRs (CI, config, dependency bumps) should use the `skip-changelog` label instead.

The changelog audience is League of Legends players, not developers. Write in a casual, direct tone about what changed in their experience.

### Database migrations

If your changes modify the database schema:

1. Run `npx drizzle-kit generate` to create migration SQL
2. Review the generated SQL in `drizzle/`
3. Apply locally: `npx drizzle-kit push`
4. Commit the migration files with your code

**Important**: if a migration creates a new table from existing data, it must include `INSERT INTO ... SELECT FROM` to populate it. The seed script is not a substitute for data migrations.

## Pull request checklist

- [ ] Description of what changed and why
- [ ] Links to related GitHub issues (`Fixes #N` or `Relates to #N`)
- [ ] Changelog entry (or `skip-changelog` label)
- [ ] `npm run build` passes locally
- [ ] `npm run test:smoke` passes (if touching UI)
- [ ] `npm run test:e2e` passes (if touching interactive flows)
- [ ] Translations updated in both `en.json` and `es.json` (if adding UI text)
- [ ] Screenshots included (if changing UI — before/after)

## Project structure overview

- `src/app/` — Next.js app router pages and layouts
- `src/components/` — Reusable UI components (shadcn/ui v4)
- `src/lib/` — Shared utilities, database queries, API clients
- `src/server/` — Server actions
- `drizzle/` — Database migration files
- `messages/` — i18n translation files (`en.json`, `es.json`)
- `changelog/` — Changelog MDX entries (`en/`, `es/`)
- `scripts/` — Build and maintenance scripts
- `e2e/` — Playwright end-to-end tests

## Getting help

- Check existing GitHub issues for context
- Open a new issue if you find a bug or want to suggest a feature
- Use the issue templates provided

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/). See `CODE_OF_CONDUCT.md` for details.

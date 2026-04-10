# LoL Tracker

[![CI](https://github.com/beagleknight/lol-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/beagleknight/lol-tracker/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)

A personal League of Legends match tracker built with Next.js 16, featuring automatic match syncing via the Riot Games API, coaching session logging, and performance analytics.

## Features

- **Automatic match syncing** — links your Riot account and keeps your match history up to date
- **Multi-account support** — track multiple Riot accounts (smurfs) under one login
- **Performance analytics** — win rates, champion stats, role breakdowns, and trends over time
- **AI-powered coaching** — get personalized feedback and action items from match reviews
- **Duo partner tracking** — find and analyze your performance with duo partners
- **Bilingual** — full English and Spanish support

## Prerequisites

- Node.js 24+ (recommended: use [fnm](https://github.com/Schniz/fnm) with the included `.tool-versions`)
- A [Discord application](https://discord.com/developers/applications) for OAuth login
- A [Riot Games API key](https://developer.riotgames.com)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example and fill in your values:

```bash
cp .env.example .env.local
```

Required variables in `.env.local`:

```
AUTH_SECRET=           # Generate with: npx auth secret
AUTH_DISCORD_ID=       # From Discord Developer Portal
AUTH_DISCORD_SECRET=   # From Discord Developer Portal
RIOT_API_KEY=          # From developer.riotgames.com
```

### 3. Set up Discord OAuth

In your Discord application settings under **OAuth2 > Redirects**, add:

```
http://localhost:3000/api/auth/callback/discord
```

### 4. Initialize the database

The app uses SQLite via `@libsql/client` (Turso). Create the data directory and push the schema:

```bash
mkdir data
npx drizzle-kit push
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Self-hosting

LoL Tracker is designed to run on [Vercel](https://vercel.com) with [Turso](https://turso.tech) as the production database, but you can adapt it to other platforms.

**Each instance requires its own credentials:**

- **Riot Games API key** — register at [developer.riotgames.com](https://developer.riotgames.com). Development keys expire every 24 hours; for a persistent deployment, apply for a production key and register your product on the Riot Developer Portal.
- **Discord OAuth app** — create one at [discord.com/developers](https://discord.com/developers/applications). Set the redirect URI to `https://your-domain.com/api/auth/callback/discord`.
- **Turso database** — create a database at [turso.tech](https://turso.tech) and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in your hosting environment.

See `.env.example` for the full list of environment variables.

Migrations are applied automatically on deploy via `scripts/migrate.ts`. No manual migration step is needed.

## Important notes

- The production build uses the `--webpack` flag because Turbopack has issues bundling `@libsql/client`.

## Scripts

| Command                  | Description                                |
| ------------------------ | ------------------------------------------ |
| `npm run dev`            | Start dev server (webpack)                 |
| `npm run build`          | Production build (webpack)                 |
| `npm run start`          | Start production server                    |
| `npm run test:smoke`     | Run Playwright smoke tests (a11y + pages)  |
| `npm run test:e2e`       | Run Playwright end-to-end tests            |
| `npx drizzle-kit push`   | Push schema changes to the database        |
| `npx drizzle-kit studio` | Open Drizzle Studio to browse the database |

## Tech stack

- **Framework:** Next.js 16 (React 19)
- **Database:** SQLite/Turso via @libsql/client + Drizzle ORM
- **Auth:** NextAuth v5 with Discord provider
- **UI:** shadcn/ui v4, Tailwind CSS v4
- **AI:** Google Gemini via Vercel AI SDK
- **i18n:** next-intl (English + Spanish)
- **Testing:** Playwright, axe-core
- **Linting:** oxlint, oxfmt
- **API:** Riot Games API for match data

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding guidelines, and the pull request workflow.

## Security

To report a security vulnerability, please email david.morcillo@gmail.com. Do **not** open a public issue. See [SECURITY.md](SECURITY.md) for details.

## Legal

LoL Tracker is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-or-later).

You are free to use, modify, and distribute this software under the terms of the AGPL. If you run a modified version as a network service, you must make the source code available to its users. See the [LICENSE](LICENSE) file for details.

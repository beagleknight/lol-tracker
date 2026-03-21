# LoL Tracker

A personal League of Legends match tracker built with Next.js 16, featuring automatic match syncing via the Riot Games API, coaching session logging, and performance analytics.

## Prerequisites

- Node.js 24+ (recommended: use [fnm](https://github.com/Schniz/fnm))
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
DISCORD_CLIENT_ID=     # From Discord Developer Portal
DISCORD_CLIENT_SECRET= # From Discord Developer Portal
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

## Important Notes

- The production build uses the `--webpack` flag because Turbopack has issues bundling `@libsql/client`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (webpack) |
| `npm run build` | Production build (webpack) |
| `npm run start` | Start production server |
| `npx drizzle-kit push` | Push schema changes to the database |
| `npx drizzle-kit studio` | Open Drizzle Studio to browse the database |

## Tech Stack

- **Framework:** Next.js 16 (React 19)
- **Database:** SQLite/Turso via @libsql/client + Drizzle ORM
- **Auth:** NextAuth v5 with Discord provider
- **UI:** shadcn/ui v4, Tailwind CSS v4
- **API:** Riot Games API for match data

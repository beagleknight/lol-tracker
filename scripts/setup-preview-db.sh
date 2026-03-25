#!/usr/bin/env bash
# scripts/setup-preview-db.sh
#
# Creates and seeds a Turso preview database for Vercel Preview deployments.
#
# Prerequisites:
#   - turso CLI installed: https://docs.turso.tech/cli/installation
#   - turso auth login completed
#   - Node.js and npm installed
#
# Usage:
#   bash scripts/setup-preview-db.sh
#
# What this script does:
#   1. Creates a Turso database named "lol-tracker-preview" in dub1 (Dublin)
#   2. Creates an auth token for it
#   3. Seeds it with demo data (tables are created automatically)
#   4. Prints the env vars to set in Vercel dashboard
#
# After running this script, configure Vercel:
#   1. Go to Project Settings > Environment Variables
#   2. For the "Preview" environment, set:
#      - TURSO_DATABASE_URL    → (printed below)
#      - TURSO_AUTH_TOKEN      → (printed below)
#      - NEXT_PUBLIC_DEMO_MODE → true
#      - AUTH_SECRET            → any random string (npx auth secret)
#   3. Remove (or don't set) for Preview:
#      - AUTH_DISCORD_ID       (not needed — fake auth)
#      - AUTH_DISCORD_SECRET   (not needed — fake auth)
#      - RIOT_API_KEY          (not needed — mocked)

set -euo pipefail

DB_NAME="lol-tracker-preview"
DB_GROUP="default"
DB_REGION="dub1"

echo "=== Creating Turso preview database ==="
echo "Database: $DB_NAME"
echo "Region:   $DB_REGION"
echo ""

# Create database (idempotent — will error if exists, that's fine)
if turso db create "$DB_NAME" --group "$DB_GROUP" 2>/dev/null; then
  echo "✓ Database created"
else
  echo "• Database already exists (or creation failed — check turso db list)"
fi

# Get the URL
DB_URL=$(turso db show "$DB_NAME" --url)
echo "✓ Database URL: $DB_URL"

# Create an auth token
echo ""
echo "Creating auth token..."
DB_TOKEN=$(turso db tokens create "$DB_NAME")
echo "✓ Auth token created"

# Seed data (the seed script creates tables via CREATE TABLE IF NOT EXISTS,
# so no separate drizzle-kit push step is needed)
echo ""
echo "=== Seeding preview database ==="
TURSO_DATABASE_URL="$DB_URL" TURSO_AUTH_TOKEN="$DB_TOKEN" npm run db:seed -- --force-remote
echo "✓ Database seeded (tables created + demo data inserted)"

# Print Vercel env vars
echo ""
echo "============================================"
echo "  Vercel Preview Environment Variables"
echo "============================================"
echo ""
echo "Set these in Vercel > Project Settings > Environment Variables"
echo "(scope: Preview only)"
echo ""
echo "  TURSO_DATABASE_URL=$DB_URL"
echo "  TURSO_AUTH_TOKEN=$DB_TOKEN"
echo "  NEXT_PUBLIC_DEMO_MODE=true"
echo "  AUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || echo 'generate-with-npx-auth-secret')"
echo ""
echo "You do NOT need to set AUTH_DISCORD_ID, AUTH_DISCORD_SECRET, or RIOT_API_KEY"
echo "for Preview deployments — they are bypassed in demo mode."
echo ""
echo "Done! Preview deployments will now use the seeded preview database."

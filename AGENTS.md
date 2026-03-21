<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:turso-migration-rules -->
# Turso migration reminder

**Run migrations against production Turso BEFORE pushing code that references new schema.** Vercel does NOT run migrations on deploy.

Steps: `npx drizzle-kit generate` -> `npx drizzle-kit migrate` (with `.env.local` credentials) -> verify -> push code.

Full workflow details are in the `vercel-turso-deploy` OpenCode skill.
<!-- END:turso-migration-rules -->

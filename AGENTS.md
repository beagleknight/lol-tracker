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

<!-- BEGIN:task-completion-rules -->
# Task completion workflow

When executing a multi-step plan (e.g., the user says "proceed" or "do it"), **always include committing and pushing as the final steps in the todo list**. The user expects code changes to be deployed — don't stop at "build passes".

Final todos should be:
1. ... (all implementation steps)
2. Commit changes with a descriptive message
3. Push to remote
<!-- END:task-completion-rules -->

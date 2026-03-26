import { execSync } from "child_process";
import path from "path";

const projectRoot = path.resolve(__dirname, "../../..");

/**
 * Re-seed the local SQLite database.
 *
 * Called in `beforeAll` of each E2E spec file to guarantee a clean,
 * deterministic starting state. The seed script already performs
 * `DELETE FROM` on every table before re-inserting, so we just run
 * it directly — no need to delete the file. Keeping the same file
 * inode is critical: the running Next.js server holds a persistent
 * connection, and deleting the file would cause SQLITE_READONLY_DBMOVED.
 */
export async function reseedDatabase() {
  console.log("[e2e] Re-seeding database...");
  execSync("npm run db:seed", {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      TURSO_DATABASE_URL: "file:./data/lol-tracker.db",
      TURSO_AUTH_TOKEN: "",
    },
  });

  // Brief pause so any in-flight server requests complete before tests start
  await new Promise((r) => setTimeout(r, 200));
  console.log("[e2e] Re-seed complete.");
}

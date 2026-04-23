// scripts/check-migration-safety.ts
// Scans new/pending migration SQL files for destructive patterns that would
// cause downtime if applied while the old deployment is still serving traffic.
//
// Detected patterns:
//   - DROP TABLE
//   - DROP COLUMN (via ALTER TABLE ... DROP COLUMN)
//   - ALTER TABLE ... RENAME COLUMN
//   - Table recreation (CREATE TABLE + INSERT INTO ... SELECT + DROP TABLE)
//
// This is a HARD BLOCKER in CI. Destructive migrations must use the
// expand-contract pattern across multiple deploys:
//   Phase 1: Add new columns/tables, deploy code that works with both schemas
//   Phase 2: Backfill/migrate data
//   Phase 3: Drop old columns/tables (separate PR, after Phase 1 is live)
//
// Usage:
//   npx tsx scripts/check-migration-safety.ts
//
// The script compares migrations in drizzle/meta/_journal.json against those
// already committed on the main branch. Only NEW migrations (not on main) are
// checked, so historical destructive migrations don't trigger false positives.

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

interface Violation {
  file: string;
  line: number;
  pattern: string;
  statement: string;
}

const DANGEROUS_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "DROP TABLE", regex: /\bDROP\s+TABLE\b/i },
  { name: "DROP COLUMN", regex: /\bALTER\s+TABLE\b[^;]*\bDROP\s+COLUMN\b/i },
  {
    name: "RENAME COLUMN",
    regex: /\bALTER\s+TABLE\b[^;]*\bRENAME\s+COLUMN\b/i,
  },
];

function getBaselineTags(): Set<string> {
  // Get the journal from origin/main to know which migrations already exist.
  // If we can't read it (e.g., new repo, no remote), treat all as new.
  try {
    const mainJournalContent = execSync(
      "git show origin/main:drizzle/meta/_journal.json 2>/dev/null",
      {
        encoding: "utf-8",
      },
    );
    const mainJournal: Journal = JSON.parse(mainJournalContent);
    return new Set(mainJournal.entries.map((e) => e.tag));
  } catch {
    // If origin/main doesn't exist or doesn't have the journal, all migrations are "new"
    // But we don't want to flag historical migrations in that case, so return all current tags
    // (this effectively means: no new migrations to check)
    console.log("⚠ Could not read journal from origin/main — checking all migrations in journal.");
    return new Set<string>();
  }
}

function main() {
  const journalPath = path.resolve(__dirname, "../drizzle/meta/_journal.json");
  if (!fs.existsSync(journalPath)) {
    console.log("No drizzle journal found — nothing to check.");
    process.exit(0);
  }

  const journal: Journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
  const baselineTags = getBaselineTags();

  // Only check migrations that are NOT on main (i.e., new in this PR)
  const newEntries = journal.entries.filter((e) => !baselineTags.has(e.tag));

  if (newEntries.length === 0) {
    console.log("✓ No new migrations to check.");
    process.exit(0);
  }

  console.log(`Checking ${newEntries.length} new migration(s) for destructive patterns...\n`);

  const violations: Violation[] = [];

  for (const entry of newEntries) {
    const sqlPath = path.resolve(__dirname, `../drizzle/${entry.tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
      console.warn(`⚠ SQL file not found: ${entry.tag}.sql — skipping.`);
      continue;
    }

    const content = fs.readFileSync(sqlPath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.regex.test(line)) {
          violations.push({
            file: `drizzle/${entry.tag}.sql`,
            line: i + 1,
            pattern: pattern.name,
            statement: line.trim().slice(0, 120),
          });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log("✓ All new migrations are safe — no destructive patterns found.");
    process.exit(0);
  }

  // Report violations
  console.error("✗ DESTRUCTIVE MIGRATION DETECTED\n");
  console.error("The following migration(s) contain patterns that would cause downtime");
  console.error("if applied while the old deployment is still serving traffic:\n");

  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    Pattern: ${v.pattern}`);
    console.error(`    SQL:     ${v.statement}`);
    console.error("");
  }

  console.error("─".repeat(70));
  console.error("");
  console.error("These changes MUST use the expand-contract pattern:");
  console.error("");
  console.error("  Phase 1 (this PR): Add new columns/tables. Deploy code that");
  console.error("    works with BOTH old and new schema.");
  console.error("");
  console.error("  Phase 2 (separate PR): Backfill/migrate data if needed.");
  console.error("");
  console.error("  Phase 3 (separate PR, AFTER Phase 1 is live): Drop old");
  console.error("    columns/tables. Only safe once no running code references them.");
  console.error("");
  console.error("See the drizzle-schema skill for detailed examples.");
  console.error("");

  process.exit(1);
}

main();

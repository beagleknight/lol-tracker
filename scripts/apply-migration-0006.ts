import { createClient } from "@libsql/client";

function cleanEnv(key: string): string | undefined {
  const val = process.env[key];
  if (!val) return undefined;
  return val.replace(/^\[dotenv@[^\]]+\][^\n]*\n/, "");
}

const db = createClient({
  url: cleanEnv("TURSO_DATABASE_URL")!,
  authToken: cleanEnv("TURSO_AUTH_TOKEN"),
});

async function run() {
  const info = await db.execute("PRAGMA table_info(matches)");
  const cols = info.rows.map((r) => r.name);
  const duoCols = cols.filter((c) => String(c).startsWith("duo_partner"));
  console.log("Duo columns:", duoCols);

  if (cols.includes("duo_partner_champion_name")) {
    console.log("Columns already exist!");
    return;
  }

  console.log("Adding columns...");
  await db.execute("ALTER TABLE `matches` ADD `duo_partner_champion_name` text");
  await db.execute("ALTER TABLE `matches` ADD `duo_partner_kills` integer");
  await db.execute("ALTER TABLE `matches` ADD `duo_partner_deaths` integer");
  await db.execute("ALTER TABLE `matches` ADD `duo_partner_assists` integer");
  console.log("Done! Columns added.");
}

run().catch(console.error);

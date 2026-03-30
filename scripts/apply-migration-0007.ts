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
  // Check if index already exists
  const indexes = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='matches'",
  );
  const indexNames = indexes.rows.map((r) => r.name);
  console.log("Existing indexes on matches:", indexNames);

  if (indexNames.includes("matches_user_duo_partner_idx")) {
    console.log("Index already exists!");
    return;
  }

  console.log("Creating index matches_user_duo_partner_idx...");
  await db.execute(
    "CREATE INDEX `matches_user_duo_partner_idx` ON `matches` (`user_id`,`duo_partner_puuid`)",
  );
  console.log("Done! Index created.");
}

run().catch(console.error);

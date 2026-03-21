import { NextResponse } from "next/server";

export async function GET() {
  const keys = [
    "AUTH_SECRET",
    "AUTH_DISCORD_ID",
    "AUTH_DISCORD_SECRET",
    "AUTH_TRUST_HOST",
    "TURSO_DATABASE_URL",
  ];

  const result: Record<string, string> = {};
  for (const key of keys) {
    const val = process.env[key] ?? "(undefined)";
    // Show first 20 chars + whether it contains the banner
    const hasBanner = val.includes("[dotenv@");
    const preview = val.substring(0, 40) + (val.length > 40 ? "..." : "");
    result[key] = `${hasBanner ? "CORRUPTED" : "CLEAN"} | ${preview}`;
  }

  return NextResponse.json(result);
}

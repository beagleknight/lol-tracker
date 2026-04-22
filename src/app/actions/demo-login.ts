"use server";

import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { signIn } from "@/lib/auth";

/**
 * Server action to log in as a demo user via the Credentials provider.
 * Only works when NEXT_PUBLIC_DEMO_MODE=true (enforced by the provider itself).
 */
export async function demoLogin(userId: string) {
  await signIn("demo", { userId, redirectTo: "/dashboard" });
}

/** Preview seed user IDs (must match seed.ts) */
const SEED_USER_IDS = [
  "seed-user-0004-0004-000000000004",
  "seed-user-0001-0001-000000000001",
  "seed-user-0002-0002-000000000002",
  "seed-user-0003-0003-000000000003",
];

export interface DemoUserInfo {
  id: string;
  name: string | null;
  role: string;
  riotGameName: string | null;
  riotTagLine: string | null;
  onboardingCompleted: boolean;
}

/**
 * Fetch demo user data from the database so the login page
 * always reflects the current role assignments.
 */
export async function getDemoUsers(): Promise<DemoUserInfo[]> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return [];

  const rows = await db.query.users.findMany({
    where: inArray(users.id, SEED_USER_IDS),
    columns: {
      id: true,
      name: true,
      role: true,
      riotGameName: true,
      riotTagLine: true,
      onboardingCompleted: true,
    },
  });

  // Return in a stable order matching SEED_USER_IDS, excluding deleted users
  return SEED_USER_IDS.flatMap((id) => {
    const row = rows.find((r) => r.id === id);
    return row
      ? [
          {
            id: row.id,
            name: row.name,
            role: row.role,
            riotGameName: row.riotGameName,
            riotTagLine: row.riotTagLine,
            onboardingCompleted: row.onboardingCompleted ?? false,
          },
        ]
      : [];
  });
}

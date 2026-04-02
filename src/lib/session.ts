import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";

// cache() deduplicates this call within a single request,
// so layout + page calling requireUser() only hits the DB once.
export const getCurrentUser = cache(async () => {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) return null;

  // Deactivated users are treated as logged out — invalidates active JWT sessions
  if (user.deactivatedAt) return null;

  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

"use server";

import { db } from "@/db";
import { invites, users } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { revalidatePath } from "next/cache";

function generateCode(): string {
  // 8-char alphanumeric code (URL-safe, easy to copy-paste)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 confusion
  let code = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) {
    code += chars[byte % chars.length];
  }
  return code;
}

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new Error("Unauthorized: admin access required");
  }
  return user;
}

export async function createInvite() {
  const admin = await requireAdmin();

  const code = generateCode();
  await db.insert(invites).values({
    code,
    createdBy: admin.id,
  });

  revalidatePath("/settings");
  return { code };
}

export async function getInvites() {
  const admin = await requireAdmin();

  const allInvites = await db.query.invites.findMany({
    orderBy: (invites, { desc }) => [desc(invites.createdAt)],
  });

  // Enrich with used-by user name
  const enriched = await Promise.all(
    allInvites.map(async (invite) => {
      let usedByName: string | null = null;
      if (invite.usedBy) {
        const usedByUser = await db.query.users.findFirst({
          where: eq(users.id, invite.usedBy),
        });
        usedByName = usedByUser?.name ?? null;
      }
      return {
        id: invite.id,
        code: invite.code,
        createdAt: invite.createdAt,
        usedBy: invite.usedBy,
        usedByName,
        usedAt: invite.usedAt,
      };
    })
  );

  return enriched;
}

export async function deleteInvite(id: number) {
  const admin = await requireAdmin();

  await db.delete(invites).where(eq(invites.id, id));
  revalidatePath("/settings");
  return { success: true };
}

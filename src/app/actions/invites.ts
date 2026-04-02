"use server";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { invites, users } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

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

export async function createInvite() {
  const admin = await requireAdmin();

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  await db.insert(invites).values({
    code,
    createdBy: admin.id,
    expiresAt,
  });

  return { code };
}

export async function getInvites() {
  await requireAdmin();

  const allInvites = await db.query.invites.findMany({
    orderBy: (invites, { desc }) => [desc(invites.createdAt)],
  });

  // Batch-fetch all users referenced by usedBy (instead of N+1 per invite)
  const usedByIds = allInvites.map((i) => i.usedBy).filter((id): id is string => !!id);

  const usedByUsers =
    usedByIds.length > 0
      ? await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, usedByIds))
      : [];

  const userNameMap = new Map(usedByUsers.map((u) => [u.id, u.name]));

  return allInvites.map((invite) => ({
    id: invite.id,
    code: invite.code,
    createdAt: invite.createdAt,
    usedBy: invite.usedBy,
    usedByName: invite.usedBy ? (userNameMap.get(invite.usedBy) ?? null) : null,
    usedAt: invite.usedAt,
    expiresAt: invite.expiresAt,
  }));
}

export async function deleteInvite(id: number) {
  await requireAdmin();

  await db.delete(invites).where(eq(invites.id, id));
  return { success: true };
}

import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/session";

export async function GET() {
  const user = await requireUser();

  const ssoPrivateKey = process.env.CANNY_SSO_PRIVATE_KEY;
  if (!ssoPrivateKey) {
    return NextResponse.json({ error: "Canny SSO is not configured" }, { status: 500 });
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email ?? undefined,
      name: user.name ?? "Unknown",
      avatarURL: user.image ?? undefined,
    },
    ssoPrivateKey,
    { algorithm: "HS256" },
  );

  return NextResponse.json({ token });
}

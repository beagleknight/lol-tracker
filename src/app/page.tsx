import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth } from "@/lib/auth";

async function HomeRedirect(): Promise<React.ReactNode> {
  await connection();
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  redirect("/login");
}

export default function Home() {
  return (
    <Suspense>
      <HomeRedirect />
    </Suspense>
  );
}

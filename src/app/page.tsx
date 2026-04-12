import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { LandingPage } from "@/components/landing/landing-page";
import { auth } from "@/lib/auth";

async function HomeContent(): Promise<React.ReactNode> {
  await connection();
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={messages}>
      <LandingPage />
    </NextIntlClientProvider>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

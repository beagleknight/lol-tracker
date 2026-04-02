import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-client";
import { requireUser } from "@/lib/session";

import { OnboardingWizard } from "./onboarding-client";

/**
 * Onboarding page — outside the (app) layout group so it has no sidebar.
 * Wraps the client wizard in the same providers the (app) layout uses
 * (AuthProvider, NextIntlClientProvider, Toaster).
 */
async function OnboardingContent() {
  await connection();
  const [user, messages] = await Promise.all([requireUser(), getMessages()]);

  // If user already completed onboarding, send them to the dashboard
  if (user.onboardingCompleted) {
    redirect("/dashboard");
  }

  return (
    <AuthProvider>
      <NextIntlClientProvider messages={messages}>
        <OnboardingWizard
          initialRegion={user.region}
          initialGameName={user.riotGameName}
          initialTagLine={user.riotTagLine}
          initialPrimaryRole={user.primaryRole}
          initialSecondaryRole={user.secondaryRole}
          isLinked={!!user.puuid}
        />
        <Toaster />
      </NextIntlClientProvider>
    </AuthProvider>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}

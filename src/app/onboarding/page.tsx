import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { requireUser } from "@/lib/session";

/**
 * Onboarding page — placeholder for PR 2.
 * Users who haven't completed onboarding are redirected here from the (app) layout.
 * The full step-by-step wizard will be implemented in a follow-up PR.
 */
async function OnboardingContent() {
  await connection();
  const user = await requireUser();

  // If user already completed onboarding, send them to the dashboard
  if (user.onboardingCompleted) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-mesh flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-md space-y-6 p-8 text-center">
        <h1 className="text-gradient-gold text-3xl font-bold tracking-tight">
          Welcome to lol-tracker
        </h1>
        <p className="text-muted-foreground">
          The onboarding wizard is coming soon. For now, please ask an admin to complete your setup.
        </p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}

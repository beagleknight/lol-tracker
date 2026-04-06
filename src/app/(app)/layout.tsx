import { and, eq } from "drizzle-orm";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { db } from "@/db";
import { matches, riotAccounts } from "@/db/schema";
import { AuthProvider } from "@/lib/auth-client";
import { getLatestChangelogVersion } from "@/lib/changelog";
import { accountScope, sidebarReviewCountsSelect } from "@/lib/match-queries";
import { requireUser } from "@/lib/session";

async function SidebarWithUser() {
  await connection();
  const user = await requireUser();

  // Redirect to onboarding if user hasn't completed setup
  if (!user.onboardingCompleted) {
    redirect("/onboarding");
  }

  // Lightweight count for sidebar review badges (excludes remakes + off-role)
  const [reviewCounts, latestVersion, userRiotAccounts] = await Promise.all([
    db
      .select(sidebarReviewCountsSelect(user.primaryRole))
      .from(matches)
      .where(and(eq(matches.userId, user.id), accountScope(matches.riotAccountId, user.activeRiotAccountId)))
      .then((rows) => rows[0]),
    getLatestChangelogVersion(),
    db
      .select({
        id: riotAccounts.id,
        puuid: riotAccounts.puuid,
        riotGameName: riotAccounts.riotGameName,
        riotTagLine: riotAccounts.riotTagLine,
        region: riotAccounts.region,
        isPrimary: riotAccounts.isPrimary,
        label: riotAccounts.label,
      })
      .from(riotAccounts)
      .where(eq(riotAccounts.userId, user.id)),
  ]);

  return (
    <AppSidebar
      user={{
        name: user.name,
        image: user.image,
        riotGameName: user.riotGameName,
        riotTagLine: user.riotTagLine,
        isRiotLinked: !!user.puuid,
        role: user.role,
      }}
      reviewCounts={{
        postGame: reviewCounts?.postGame ?? 0,
        vod: reviewCounts?.vod ?? 0,
      }}
      latestChangelogVersion={latestVersion}
      riotAccounts={userRiotAccounts}
      activeRiotAccountId={user.activeRiotAccountId}
    />
  );
}

/**
 * Async server component that fetches i18n messages (reads cookies() internally)
 * and provides them to client components via NextIntlClientProvider.
 * Must be wrapped in <Suspense> because getMessages() accesses cookies(),
 * which is uncached runtime data under cacheComponents: true.
 */
async function LocalizedContent({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Suspense>
        <LocalizedContent>
          <div className="bg-mesh flex min-h-screen">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
            >
              Skip to main content
            </a>
            <Suspense>
              <SidebarWithUser />
            </Suspense>
            <main id="main-content" className="flex-1 md:ml-64">
              <div className="container mx-auto max-w-7xl p-6 md:p-8">{children}</div>
            </main>
          </div>
          <Toaster />
        </LocalizedContent>
      </Suspense>
    </AuthProvider>
  );
}

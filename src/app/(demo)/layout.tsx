import { eq, and } from "drizzle-orm";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { DemoBanner } from "@/components/demo-banner";
import { Toaster } from "@/components/ui/sonner";
import { db } from "@/db";
import { matches } from "@/db/schema";
import { AuthProvider } from "@/lib/auth-client";
import { getLatestChangelogVersion } from "@/lib/changelog";
import {
  DEMO_USER_ID,
  DEMO_RIOT_ACCOUNT_ID,
  getDemoUser,
  getDemoRiotAccounts,
} from "@/lib/demo-user";
import { accountScope, sidebarReviewCountsSelect } from "@/lib/match-queries";

async function DemoSidebar() {
  await connection();
  const user = await getDemoUser();

  if (!user) {
    return null;
  }

  const [reviewCounts, latestVersion, demoRiotAccounts] = await Promise.all([
    db
      .select(sidebarReviewCountsSelect(user.primaryRole))
      .from(matches)
      .where(
        and(
          eq(matches.userId, DEMO_USER_ID),
          accountScope(matches.riotAccountId, DEMO_RIOT_ACCOUNT_ID),
        ),
      )
      .then((rows) => rows[0]),
    getLatestChangelogVersion(),
    getDemoRiotAccounts(),
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
      riotAccounts={demoRiotAccounts}
      activeRiotAccountId={user.activeRiotAccountId}
      demo
    />
  );
}

async function LocalizedContent({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
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
            <DemoBanner />
            <Suspense>
              <DemoSidebar />
            </Suspense>
            <main id="main-content" className="flex-1 md:ml-64">
              <div className="container mx-auto max-w-7xl p-6 pt-16 md:p-8 md:pt-16">
                {children}
              </div>
            </main>
          </div>
          <Toaster />
        </LocalizedContent>
      </Suspense>
    </AuthProvider>
  );
}

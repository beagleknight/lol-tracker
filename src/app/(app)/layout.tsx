import { Suspense } from "react";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { AppSidebar } from "@/components/app-sidebar";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";
import { db } from "@/db";
import { matches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLatestChangelogVersion } from "@/lib/changelog";
import { sidebarReviewCountsSelect } from "@/lib/match-queries";

async function SidebarWithUser() {
  await connection();
  const user = await requireUser();

  // Lightweight count for sidebar review badges (excludes remakes)
  const [reviewCounts, latestVersion] = await Promise.all([
    db
      .select(sidebarReviewCountsSelect())
      .from(matches)
      .where(eq(matches.userId, user.id))
      .then((rows) => rows[0]),
    getLatestChangelogVersion(),
  ]);

  return (
    <AppSidebar
      user={{
        name: user.name,
        image: user.image,
        riotGameName: user.riotGameName,
        riotTagLine: user.riotTagLine,
        puuid: user.puuid,
      }}
      reviewCounts={{
        postGame: reviewCounts?.postGame ?? 0,
        vod: reviewCounts?.vod ?? 0,
      }}
      latestChangelogVersion={latestVersion}
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
  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <Suspense>
        <LocalizedContent>
          <div className="flex min-h-screen bg-mesh">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:text-sm focus:font-medium focus:shadow-lg"
            >
              Skip to main content
            </a>
            <Suspense>
              <SidebarWithUser />
            </Suspense>
            <main id="main-content" className="flex-1 md:ml-64">
              <div className="container mx-auto max-w-7xl p-6 md:p-8">
                {children}
              </div>
            </main>
          </div>
          <Toaster />
        </LocalizedContent>
      </Suspense>
    </SessionProvider>
  );
}

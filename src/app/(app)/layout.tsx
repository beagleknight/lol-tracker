import { Suspense } from "react";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { AppSidebar } from "@/components/app-sidebar";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";
import { db } from "@/db";
import { matches, matchHighlights } from "@/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { getLatestChangelogVersion } from "@/lib/changelog";

async function SidebarWithUser() {
  await connection();
  const user = await requireUser();

  // Lightweight count for sidebar review badges
  const [reviewCounts, latestVersion] = await Promise.all([
    db
      .select({
        postGame: count(
          sql`CASE WHEN ${matches.reviewed} = 0 AND ${matches.comment} IS NULL AND NOT EXISTS (
            SELECT 1 FROM ${matchHighlights} WHERE ${matchHighlights.matchId} = ${matches.id}
          ) THEN 1 END`
        ),
        vod: count(
          sql`CASE WHEN ${matches.reviewed} = 0 AND (
            ${matches.comment} IS NOT NULL
            OR EXISTS (SELECT 1 FROM ${matchHighlights} WHERE ${matchHighlights.matchId} = ${matches.id})
          ) THEN 1 END`
        ),
      })
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
            <Suspense>
              <SidebarWithUser />
            </Suspense>
            <main className="flex-1 md:ml-64">
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

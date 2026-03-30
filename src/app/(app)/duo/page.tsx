import { Suspense } from "react";

import { getDuoPartnerInfo, getDuoStats, getDuoGames, getChampionSynergy } from "@/app/actions/duo";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLatestVersion } from "@/lib/riot-api";

import {
  DuoHeader,
  DuoNoPartner,
  DuoNoGames,
  DuoStatsCards,
  DuoKdaCards,
  DuoSynergyCard,
  DuoRecentGames,
} from "./duo-client";

// ─── Skeleton fallbacks for Suspense boundaries ────────────────────────────

function StatsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="surface-glow">
            <CardContent className="pt-6">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-2 h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="surface-glow">
            <CardHeader>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-6 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function SynergySkeleton() {
  return (
    <Card className="surface-glow">
      <CardHeader>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-1 h-4 w-52" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border/50 p-2">
            <div className="flex items-center gap-1">
              <Skeleton className="h-7 w-7 rounded" />
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-7 w-7 rounded" />
            </div>
            <Skeleton className="h-4 w-32 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RecentGamesSkeleton() {
  return (
    <Card className="surface-glow">
      <CardHeader>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-1 h-4 w-52" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-8 w-8 rounded" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-3 w-3" />
            <Skeleton className="h-8 w-8 rounded" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-14" />
            </div>
            <div className="ml-auto space-y-1">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Async server components that fetch their own data ─────────────────────

async function DuoStatsSection({ partnerName }: { partnerName: string }) {
  const stats = await getDuoStats();

  if (!stats || stats.totalGames === 0) {
    return <DuoNoGames />;
  }

  return (
    <>
      <DuoStatsCards stats={stats} />
      <DuoKdaCards stats={stats} partnerName={partnerName} />
    </>
  );
}

async function DuoSynergySection({
  partnerName,
  ddragonVersion,
}: {
  partnerName: string;
  ddragonVersion: string;
}) {
  const synergy = await getChampionSynergy();

  return (
    <DuoSynergyCard synergy={synergy} partnerName={partnerName} ddragonVersion={ddragonVersion} />
  );
}

async function DuoRecentGamesSection({
  partnerName,
  ddragonVersion,
}: {
  partnerName: string;
  ddragonVersion: string;
}) {
  const gamesResult = await getDuoGames(1);

  return (
    <DuoRecentGames
      initialGames={gamesResult.games}
      initialTotalPages={gamesResult.totalPages}
      partnerName={partnerName}
      ddragonVersion={ddragonVersion}
    />
  );
}

// ─── Page component ────────────────────────────────────────────────────────

export default async function DuoPage() {
  // These two are fast (PK lookups + cached CDN) — fetch them blocking
  const [partnerInfo, ddragonVersion] = await Promise.all([
    getDuoPartnerInfo(),
    getLatestVersion(),
  ]);

  // No duo partner configured — render immediately, no Suspense needed
  if (!partnerInfo) {
    return (
      <div className="space-y-6">
        <DuoHeader partnerName={null} />
        <DuoNoPartner />
      </div>
    );
  }

  const partnerName = partnerInfo.riotGameName || partnerInfo.name || "Partner";

  return (
    <div className="space-y-6">
      <DuoHeader
        partnerName={
          partnerInfo.riotGameName
            ? `${partnerInfo.riotGameName}#${partnerInfo.riotTagLine}`
            : partnerInfo.name || "Partner"
        }
      />

      <Suspense fallback={<StatsSkeleton />}>
        <DuoStatsSection partnerName={partnerName} />
      </Suspense>

      <Suspense fallback={<SynergySkeleton />}>
        <DuoSynergySection partnerName={partnerName} ddragonVersion={ddragonVersion} />
      </Suspense>

      <Suspense fallback={<RecentGamesSkeleton />}>
        <DuoRecentGamesSection partnerName={partnerName} ddragonVersion={ddragonVersion} />
      </Suspense>
    </div>
  );
}

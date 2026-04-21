import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { MatchDetailClient } from "@/app/(app)/matches/[id]/match-detail-client";
import { getDemoUser } from "@/lib/demo-user";
import { getMatchDetailData } from "@/lib/queries/match-detail";

export default async function DemoMatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const user = await getDemoUser();
  if (!user) redirect("/login");

  const data = await getMatchDetailData(id, user.id, user.activeRiotAccountId, user.puuid);

  if (!data) {
    notFound();
  }

  return (
    <MatchDetailClient
      match={data.match}
      participants={data.participants}
      linkedSessions={data.linkedSessions}
      highlights={data.highlights}
      matchupNotes={data.matchupNotes}
      ddragonVersion={data.ddragonVersion}
      userPuuid={data.userPuuid}
      userPrimaryRole={user.primaryRole}
      isAiConfigured={data.aiConfigured}
      cachedAiInsight={data.cachedAiInsight}
      readOnly
    />
  );
}

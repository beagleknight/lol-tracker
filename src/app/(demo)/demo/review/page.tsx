import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ReviewClient } from "@/app/(app)/review/review-client";
import { getDemoUser } from "@/lib/demo-user";
import { getReviewData } from "@/lib/queries/review";

export default async function DemoReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const user = await getDemoUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  const data = await getReviewData(user.id, user.activeRiotAccountId, user.primaryRole, {
    completedPage: typeof params.completedPage === "string" ? params.completedPage : undefined,
    tab: typeof params.tab === "string" ? params.tab : undefined,
  });

  return (
    <ReviewClient
      unreviewedMatches={data.unreviewedMatches}
      reviewedMatches={data.reviewedMatches}
      highlightsByMatch={data.highlightsByMatch}
      ddragonVersion={data.ddragonVersion}
      completedPage={data.completedPage}
      completedTotalPages={data.completedTotalPages}
      completedTotal={data.completedTotal}
      initialTab={data.initialTab}
      topics={data.topics}
      readOnly
    />
  );
}

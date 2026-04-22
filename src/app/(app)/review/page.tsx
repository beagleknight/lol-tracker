import { getReviewData } from "@/lib/queries/review";
import { requireUser } from "@/lib/session";

import { ReviewClient } from "./review-client";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const data = await getReviewData(user.id, user.activeRiotAccountId, user.primaryRole, {
    reviewedPage: typeof params.reviewedPage === "string" ? params.reviewedPage : undefined,
    tab: typeof params.tab === "string" ? params.tab : undefined,
  });

  return (
    <ReviewClient
      unreviewedMatches={data.unreviewedMatches}
      reviewedMatches={data.reviewedMatches}
      highlightsByMatch={data.highlightsByMatch}
      ddragonVersion={data.ddragonVersion}
      reviewedPage={data.reviewedPage}
      reviewedTotalPages={data.reviewedTotalPages}
      reviewedTotal={data.reviewedTotal}
      initialTab={data.initialTab}
      topics={data.topics}
      activeActionItems={data.activeActionItems}
    />
  );
}

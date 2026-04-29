import { getTranslations } from "next-intl/server";

import { FeedbackClient } from "./feedback-client";

export default async function FeedbackPage() {
  const t = await getTranslations("Feedback");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-teal">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">{t("pageSubtitle")}</p>
      </div>

      <FeedbackClient />
    </div>
  );
}

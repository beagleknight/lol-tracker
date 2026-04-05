import { MessageSquarePlus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FeedbackClient } from "./feedback-client";

export default async function FeedbackPage() {
  const t = await getTranslations("Feedback");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquarePlus className="h-7 w-7 text-gold" />
        <div>
          <h1 className="text-gradient-gold text-3xl font-bold tracking-tight">{t("pageTitle")}</h1>
          <p className="mt-1 text-muted-foreground">{t("pageSubtitle")}</p>
        </div>
      </div>

      <FeedbackClient />
    </div>
  );
}

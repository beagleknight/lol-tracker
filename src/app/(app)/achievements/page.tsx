import { getTranslations } from "next-intl/server";

import { evaluateAchievements, getAchievementProgress } from "@/lib/achievements";
import { requireUser } from "@/lib/session";

import { AchievementsClient } from "./achievements-client";

export default async function AchievementsPage() {
  const user = await requireUser();
  const t = await getTranslations("Achievements");

  // Evaluate achievements on page visit so existing users get credit
  // for their historical data without needing to trigger a sync first.
  await evaluateAchievements(user.id);

  const progress = await getAchievementProgress(user.id);

  const unlocked = progress.filter((p) => p.unlocked).length;
  const total = progress.length;
  const secretRemaining = progress.filter((p) => p.def.secret && !p.unlocked).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">{t("pageDescription")}</p>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-lg border border-border/50 bg-card px-4 py-2">
          <span className="text-sm font-medium text-gold">{t("summary", { unlocked, total })}</span>
        </div>
        {secretRemaining > 0 && (
          <div className="rounded-lg border border-border/50 bg-card px-4 py-2">
            <span className="text-sm text-muted-foreground">
              {t("secretRemaining", { count: secretRemaining })}
            </span>
          </div>
        )}
      </div>

      <AchievementsClient progress={progress} />
    </div>
  );
}

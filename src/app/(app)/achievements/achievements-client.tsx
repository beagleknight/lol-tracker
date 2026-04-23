"use client";

import { useTranslations } from "next-intl";

import { AchievementBadge } from "@/components/achievement-badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ACHIEVEMENT_CATEGORIES,
  getTierName,
  type AchievementCategory,
  type AchievementProgress,
} from "@/lib/achievements";
import { cn } from "@/lib/utils";

interface AchievementsClientProps {
  progress: AchievementProgress[];
}

const TIER_LABEL_KEYS: Record<string, string> = {
  iron: "tierIron",
  bronze: "tierBronze",
  silver: "tierSilver",
  gold: "tierGold",
  platinum: "tierPlatinum",
  diamond: "tierDiamond",
};

const TAB_KEYS: Record<string, string> = {
  all: "tabAll",
  coaching: "tabCoaching",
  challenges: "tabChallenges",
  reviews: "tabReviews",
  matches: "tabMatches",
  combat: "tabCombat",
  highlights: "tabHighlights",
  general: "tabGeneral",
};

function AchievementCard({
  item,
  t,
}: {
  item: AchievementProgress;
  t: ReturnType<typeof useTranslations<"Achievements">>;
}) {
  const { def, unlocked, currentTier, progress, nextThreshold, unlockedAt } = item;

  // Secret + locked: show mystery card
  const isSecretLocked = def.secret && !unlocked;

  const title = isSecretLocked ? "???" : t(`${def.id}.title` as Parameters<typeof t>[0]);
  const description = isSecretLocked
    ? t("lockedSecret")
    : t(`${def.id}.description` as Parameters<typeof t>[0]);

  // Tier label
  const tierLabel =
    unlocked && currentTier
      ? t(TIER_LABEL_KEYS[getTierName(currentTier)]! as Parameters<typeof t>[0])
      : null;

  // Progress bar for tiered achievements
  const showProgress = def.tiers !== null && nextThreshold !== null;
  const progressPercent = showProgress
    ? Math.min(100, Math.round((progress / nextThreshold!) * 100))
    : 0;

  return (
    <div
      className={cn(
        "flex gap-4 rounded-xl border border-border/50 p-4 transition-colors",
        unlocked ? "bg-card" : "bg-card/50 opacity-70",
      )}
    >
      <AchievementBadge
        icon={def.icon}
        category={def.category}
        unlocked={unlocked}
        secret={def.secret}
        tier={currentTier}
        size="lg"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className={cn("text-sm font-semibold", !unlocked && "text-muted-foreground")}>
            {title}
          </h3>
          {tierLabel && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                getTierBadgeClasses(currentTier!),
              )}
            >
              {tierLabel}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>

        {/* Progress bar for tiered achievements */}
        {showProgress && (
          <div className="pt-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("progressLabel", { current: progress, next: nextThreshold })}</span>
              {unlocked && def.tiers && currentTier === def.tiers.length && (
                <span className="text-gold">{t("maxTierLabel")}</span>
              )}
            </div>
            <Progress value={progressPercent} className="mt-1 h-1.5" />
          </div>
        )}

        {/* Max tier indicator */}
        {unlocked && def.tiers && currentTier === def.tiers.length && !showProgress && (
          <p className="text-xs text-gold">{t("maxTierLabel")}</p>
        )}

        {/* Unlock date */}
        {unlocked && unlockedAt && (
          <p className="text-xs text-muted-foreground/60">
            {t("unlockedLabel", {
              date: unlockedAt.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              }),
            })}
          </p>
        )}
      </div>
    </div>
  );
}

function getTierBadgeClasses(tier: number): string {
  const name = getTierName(tier);
  switch (name) {
    case "iron":
      return "bg-zinc-500/20 text-zinc-400";
    case "bronze":
      return "bg-amber-700/20 text-amber-600";
    case "silver":
      return "bg-slate-300/20 text-slate-300";
    case "gold":
      return "bg-yellow-400/20 text-yellow-400";
    case "platinum":
      return "bg-cyan-400/20 text-cyan-400";
    case "diamond":
      return "bg-blue-400/20 text-blue-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function AchievementsClient({ progress }: AchievementsClientProps) {
  const t = useTranslations("Achievements");

  const categories: (AchievementCategory | "all")[] = ["all", ...ACHIEVEMENT_CATEGORIES];

  return (
    <Tabs defaultValue="all">
      <TabsList className="flex-wrap">
        {categories.map((cat) => (
          <TabsTrigger key={cat} value={cat}>
            {t(TAB_KEYS[cat]! as Parameters<typeof t>[0])}
          </TabsTrigger>
        ))}
      </TabsList>

      {categories.map((cat) => {
        const items = cat === "all" ? progress : progress.filter((p) => p.def.category === cat);
        // Sort: unlocked first (by tier desc), then locked
        const sorted = [...items].sort((a, b) => {
          if (a.unlocked && !b.unlocked) return -1;
          if (!a.unlocked && b.unlocked) return 1;
          if (a.currentTier && b.currentTier) return b.currentTier - a.currentTier;
          return 0;
        });

        return (
          <TabsContent key={cat} value={cat}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((item) => (
                <AchievementCard key={item.def.id} item={item} t={t} />
              ))}
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

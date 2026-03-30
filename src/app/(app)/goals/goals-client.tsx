"use client";

import { Target, Plus, Trophy, Archive, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import type { Goal } from "@/db/schema";

import { retireGoal, deleteGoal } from "@/app/actions/goals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { formatDate, DEFAULT_LOCALE } from "@/lib/format";
import { formatTierDivision, calculateProgress } from "@/lib/rank";

interface GoalsClientProps {
  goals: Goal[];
  currentRank: {
    tier: string;
    division: string | null;
    lp: number;
  } | null;
}

export function GoalsClient({ goals, currentRank }: GoalsClientProps) {
  const t = useTranslations("Goals");
  const { data: session } = useSession();
  const locale = session?.user?.locale ?? DEFAULT_LOCALE;

  const activeGoal = goals.find((g) => g.status === "active");
  const pastGoals = goals.filter((g) => g.status !== "active");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {!activeGoal && (
          <Link href="/goals/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("newGoal")}
            </Button>
          </Link>
        )}
      </div>

      {/* Active Goal */}
      {activeGoal ? (
        <ActiveGoalCard goal={activeGoal} currentRank={currentRank} locale={locale} />
      ) : (
        <Card className="border-dashed border-muted-foreground/25">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Target className="mb-3 h-8 w-8 text-gold" />
            <p className="text-lg font-medium">{t("noActiveGoal")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("noActiveGoalDescription")}</p>
            <Link href="/goals/new" className="mt-4">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("setGoal")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Past Goals */}
      {pastGoals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("pastGoals")}</h2>
          <div className="space-y-3">
            {pastGoals.map((goal) => (
              <PastGoalCard key={goal.id} goal={goal} locale={locale} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Active Goal Card ───────────────────────────────────────────────────────

function ActiveGoalCard({
  goal,
  currentRank,
  locale,
}: {
  goal: Goal;
  currentRank: GoalsClientProps["currentRank"];
  locale: string;
}) {
  const t = useTranslations("Goals");
  const [isRetiring, startRetire] = useTransition();

  const progress = currentRank
    ? calculateProgress(
        goal.startTier,
        goal.startDivision,
        goal.startLp,
        currentRank.tier,
        currentRank.division,
        currentRank.lp,
        goal.targetTier,
        goal.targetDivision,
      )
    : 0;

  const isOverdue = goal.deadline && new Date(goal.deadline) < new Date();

  function handleRetire() {
    if (!confirm(t("retireConfirm"))) return;
    startRetire(async () => {
      try {
        const result = await retireGoal(goal.id);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(t("toasts.goalRetired"));
        }
      } catch {
        toast.error(t("toasts.retireError"));
      }
    });
  }

  return (
    <Card className="surface-glow border-gold/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-gold" />
            <CardTitle className="text-lg">{goal.title}</CardTitle>
          </div>
          <Badge className="border-gold/30 bg-gold/20 text-gold">{t("active")}</Badge>
        </div>
        <CardDescription>
          {t("startedFrom", {
            rank: formatTierDivision(goal.startTier, goal.startDivision),
          })}
          {" · "}
          {formatDate(goal.createdAt, locale, "short")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div>
          <Progress value={progress}>
            <ProgressLabel>{t("progress")}</ProgressLabel>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">{progress}%</span>
          </Progress>
          {currentRank && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("currentRank", {
                rank: formatTierDivision(currentRank.tier, currentRank.division),
                lp: currentRank.lp,
              })}
            </p>
          )}
        </div>

        {/* Deadline warning */}
        {isOverdue && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {t("overdue", {
                date: formatDate(goal.deadline!, locale, "short"),
              })}
            </span>
          </div>
        )}

        {goal.deadline && !isOverdue && (
          <p className="text-sm text-muted-foreground">
            {t("deadline", {
              date: formatDate(goal.deadline, locale, "short"),
            })}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRetire} disabled={isRetiring}>
            {isRetiring ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Archive className="mr-2 h-3 w-3" />
            )}
            {t("retire")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Past Goal Card ─────────────────────────────────────────────────────────

function PastGoalCard({ goal, locale }: { goal: Goal; locale: string }) {
  const t = useTranslations("Goals");
  const [isDeleting, startDelete] = useTransition();

  function handleDelete() {
    if (!confirm(t("deleteConfirm"))) return;
    startDelete(async () => {
      try {
        await deleteGoal(goal.id);
        toast.success(t("toasts.goalDeleted"));
      } catch {
        toast.error(t("toasts.deleteError"));
      }
    });
  }

  const isAchieved = goal.status === "achieved";

  return (
    <Card className={isAchieved ? "border-win/20" : "border-border/50"}>
      <CardContent className="flex items-center gap-4 py-4">
        {isAchieved ? (
          <Trophy className="h-5 w-5 shrink-0 text-win" />
        ) : (
          <Archive className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{goal.title}</p>
          <p className="text-xs text-muted-foreground">
            {isAchieved
              ? t("achievedOn", {
                  date: formatDate(goal.achievedAt!, locale, "short"),
                })
              : t("retiredOn", {
                  date: formatDate(goal.retiredAt!, locale, "short"),
                })}
          </p>
        </div>
        <Badge
          variant={isAchieved ? "default" : "secondary"}
          className={isAchieved ? "border-win/30 bg-win/20 text-win" : ""}
        >
          {isAchieved ? t("achieved") : t("retired")}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label="Delete goal"
        >
          {isDeleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

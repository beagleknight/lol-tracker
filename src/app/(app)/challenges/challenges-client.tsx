"use client";

import {
  Target,
  Plus,
  Trophy,
  Archive,
  Trash2,
  Loader2,
  AlertTriangle,
  Gamepad2,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { Challenge } from "@/db/schema";

import { retireChallenge, deleteChallenge } from "@/app/actions/challenges";
import { EmptyState } from "@/components/empty-state";
import { Pagination, paginate } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-client";
import { formatDate, DEFAULT_LOCALE } from "@/lib/format";
import { formatTierDivision, calculateProgress } from "@/lib/rank";
import { cn } from "@/lib/utils";

interface ChallengesClientProps {
  challenges: Challenge[];
  topicsByChallenge: Record<number, { id: number; name: string; slug: string }[]>;
  currentRank: { tier: string; division: string | null; lp: number } | null;
}

function getMetricDescription(
  t: ReturnType<typeof useTranslations<"Challenges">>,
  metric: string | null,
  condition: string | null,
  threshold: number | null,
): string {
  if (!metric || !condition || threshold === null) return "";
  const key = `metricDescription.${metric}${condition.charAt(0).toUpperCase() + condition.slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic i18n key
  return t(key as any, { threshold });
}

export function ChallengesClient({
  challenges,
  topicsByChallenge,
  currentRank,
}: ChallengesClientProps) {
  const t = useTranslations("Challenges");
  const { user } = useAuth();
  const locale = user?.locale ?? DEFAULT_LOCALE;

  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const currentTab = tabParam === "past" ? "past" : "active";

  const activeChallenges = challenges.filter((c) => c.status === "active");
  const pastChallenges = challenges.filter((c) => c.status !== "active");

  const [activePage, setActivePage] = useState(1);
  const [pastPage, setPastPage] = useState(1);

  const paginatedActive = paginate(activeChallenges, activePage);
  const paginatedPast = paginate(pastChallenges, pastPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-in-up flex items-center justify-between">
        <div>
          <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link href="/challenges/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("newChallenge")}
          </Button>
        </Link>
      </div>

      {/* Tabbed layout */}
      <Tabs
        value={currentTab}
        onValueChange={(v) => router.replace(`/challenges?tab=${v}`, { scroll: false })}
      >
        <TabsList>
          <TabsTrigger value="active">
            {t("activeChallenges")} ({activeChallenges.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            {t("pastChallenges")} ({pastChallenges.length})
          </TabsTrigger>
        </TabsList>

        {/* Active tab */}
        <TabsContent value="active">
          {activeChallenges.length > 0 ? (
            <div className="space-y-3">
              {paginatedActive.map((challenge) => (
                <ActiveChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  topics={topicsByChallenge[challenge.id] ?? []}
                  currentRank={currentRank}
                  locale={locale}
                />
              ))}
              <Pagination
                currentPage={activePage}
                totalItems={activeChallenges.length}
                onPageChange={setActivePage}
              />
            </div>
          ) : (
            <EmptyState
              icon={Target}
              title={t("noChallenges")}
              description={t("noChallengesDescription")}
              action={
                <Link href="/challenges/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("newChallenge")}
                  </Button>
                </Link>
              }
            />
          )}
        </TabsContent>

        {/* Past tab */}
        <TabsContent value="past">
          {pastChallenges.length > 0 ? (
            <div className="space-y-3">
              {paginatedPast.map((challenge) => (
                <PastChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  topics={topicsByChallenge[challenge.id] ?? []}
                  locale={locale}
                />
              ))}
              <Pagination
                currentPage={pastPage}
                totalItems={pastChallenges.length}
                onPageChange={setPastPage}
              />
            </div>
          ) : (
            <EmptyState
              icon={Archive}
              title={t("noPastChallenges")}
              description={t("noPastChallengesDescription")}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Active Challenge Card ──────────────────────────────────────────────────

function ActiveChallengeCard({
  challenge,
  topics,
  currentRank,
  locale,
}: {
  challenge: Challenge;
  topics: { id: number; name: string; slug: string }[];
  currentRank: ChallengesClientProps["currentRank"];
  locale: string;
}) {
  const t = useTranslations("Challenges");
  const [isRetiring, startRetire] = useTransition();

  const isByDate = challenge.type === "by-date";

  const progress = isByDate
    ? currentRank
      ? calculateProgress(
          challenge.startTier ?? "",
          challenge.startDivision,
          challenge.startLp ?? 0,
          currentRank.tier,
          currentRank.division,
          currentRank.lp,
          challenge.targetTier ?? "",
          challenge.targetDivision,
        )
      : 0
    : challenge.targetGames
      ? Math.round(((challenge.currentGames ?? 0) / challenge.targetGames) * 100)
      : 0;

  const isOverdue = isByDate && challenge.deadline && new Date(challenge.deadline) < new Date();

  function handleRetire() {
    if (!confirm(t("retireConfirm"))) return;
    startRetire(async () => {
      try {
        const result = await retireChallenge(challenge.id);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(t("toasts.challengeRetired"));
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
            {isByDate ? (
              <Target className="h-5 w-5 text-gold" />
            ) : (
              <Gamepad2 className="h-5 w-5 text-gold" />
            )}
            <CardTitle className="text-lg">{challenge.title}</CardTitle>
          </div>
          <Badge className="border-gold/30 bg-gold/20 text-gold">{t("active")}</Badge>
        </div>
        <CardDescription>
          {isByDate
            ? `${t("startedFrom", { rank: formatTierDivision(challenge.startTier ?? "", challenge.startDivision) })} · ${formatDate(challenge.createdAt, locale, "short")}`
            : getMetricDescription(
                t,
                challenge.metric,
                challenge.metricCondition,
                challenge.metricThreshold,
              )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div>
          <Progress value={progress}>
            <ProgressLabel>{isByDate ? t("progress") : t("gamesProgress")}</ProgressLabel>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {isByDate
                ? `${progress}%`
                : `${challenge.currentGames ?? 0}/${challenge.targetGames ?? 0}`}
            </span>
          </Progress>
          {isByDate && currentRank && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("currentRank", {
                rank: formatTierDivision(currentRank.tier, currentRank.division),
                lp: currentRank.lp,
              })}
            </p>
          )}
        </div>

        {/* Deadline warning (by-date only) */}
        {isByDate && isOverdue && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {t("overdue", {
                date: formatDate(challenge.deadline!, locale, "short"),
              })}
            </span>
          </div>
        )}

        {isByDate && challenge.deadline && !isOverdue && (
          <p className="text-sm text-muted-foreground">
            {t("deadline", {
              date: formatDate(challenge.deadline, locale, "short"),
            })}
          </p>
        )}

        {/* Topic badges */}
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {topics.map((topic) => (
              <Badge key={topic.id} variant="secondary" className="text-xs">
                {topic.name}
              </Badge>
            ))}
          </div>
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

// ─── Past Challenge Card ────────────────────────────────────────────────────

function PastChallengeCard({
  challenge,
  topics,
  locale,
}: {
  challenge: Challenge;
  topics: { id: number; name: string; slug: string }[];
  locale: string;
}) {
  const t = useTranslations("Challenges");
  const [isDeleting, startDelete] = useTransition();

  function handleDelete() {
    if (!confirm(t("deleteConfirm"))) return;
    startDelete(async () => {
      try {
        await deleteChallenge(challenge.id);
        toast.success(t("toasts.challengeDeleted"));
      } catch {
        toast.error(t("toasts.deleteError"));
      }
    });
  }

  const statusConfig = {
    completed: {
      icon: Trophy,
      iconClass: "text-win",
      borderClass: "border-win/20",
      badgeClass: "border-win/30 bg-win/20 text-win",
      dateKey: "completedOn" as const,
      dateValue: challenge.completedAt,
    },
    failed: {
      icon: XCircle,
      iconClass: "text-destructive",
      borderClass: "border-destructive/20",
      badgeClass: "border-destructive/30 bg-destructive/20 text-destructive",
      dateKey: "failedOn" as const,
      dateValue: challenge.failedAt,
    },
    retired: {
      icon: Archive,
      iconClass: "text-muted-foreground",
      borderClass: "border-border/50",
      badgeClass: "",
      dateKey: "retiredOn" as const,
      dateValue: challenge.retiredAt,
    },
  };

  const config =
    statusConfig[challenge.status as keyof typeof statusConfig] ?? statusConfig.retired;
  const StatusIcon = config.icon;

  return (
    <Card className={config.borderClass}>
      <CardContent className="flex items-center gap-4 py-4">
        <StatusIcon className={`h-5 w-5 shrink-0 ${config.iconClass}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{challenge.title}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs text-muted-foreground">
              {config.dateValue
                ? t(config.dateKey, { date: formatDate(config.dateValue, locale, "short") })
                : ""}
            </p>
            {topics.map((topic) => (
              <Badge key={topic.id} variant="secondary" className="px-1.5 py-0 text-[10px]">
                {topic.name}
              </Badge>
            ))}
          </div>
        </div>
        <Badge
          variant={challenge.status === "completed" ? "default" : "secondary"}
          className={config.badgeClass}
        >
          {t(challenge.status as "completed" | "failed" | "retired")}
        </Badge>
        {challenge.status === "failed" && (
          <Link
            href="/challenges/new"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-7 gap-1.5 text-xs",
            )}
          >
            <RotateCcw className="h-3 w-3" />
            {t("tryAgain")}
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label={t("deleteChallenge")}
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

"use client";

import { Target, Loader2, AlertCircle, Gamepad2, ChevronRight, ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";

import type { ChallengeMetric, MetricCondition } from "@/app/actions/challenges";

import { createByDateChallenge, createByGamesChallenge } from "@/app/actions/challenges";
import { BackButton } from "@/components/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIER_ORDER, DIVISION_ORDER, formatTierDivision, toCumulativeLP } from "@/lib/rank";

export interface NewChallengeClientProps {
  currentRank: {
    tier: string;
    division: string | null;
    lp: number;
  } | null;
  availableTopics: { id: number; name: string }[];
  playerStats: {
    cspm: number | null;
    deaths: number | null;
    visionScore: number | null;
    totalGames: number;
  };
}

const MASTER_PLUS_INDEX = TIER_ORDER.indexOf("MASTER");

const METRIC_LABELS: Record<string, string> = {
  cspm: "CS/min",
  deaths: "Deaths",
  vision_score: "Vision score",
};

type WizardStep = "type" | "config" | "topics";

function formatTierLabel(tier: string): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

/** Compute a difficulty label based on player stats vs threshold */
function getDifficulty(
  metric: string,
  condition: string,
  threshold: number,
  playerStats: NewChallengeClientProps["playerStats"],
): { label: string; color: string } | null {
  const avg =
    metric === "cspm"
      ? playerStats.cspm
      : metric === "deaths"
        ? playerStats.deaths
        : metric === "vision_score"
          ? playerStats.visionScore
          : null;

  if (avg == null || playerStats.totalGames < 5) return null;

  // How far off are they? Positive = easy direction, negative = hard
  let gap: number;
  if (condition === "at_least") {
    gap = avg - threshold; // positive means already above target
  } else {
    gap = threshold - avg; // positive means already below target
  }

  // Normalize by the average to get a relative gap
  const rel = avg !== 0 ? gap / avg : gap;

  if (rel > 0.2) return { label: "easy", color: "text-win" };
  if (rel > 0) return { label: "feasible", color: "text-gold" };
  if (rel > -0.2) return { label: "challenging", color: "text-warning" };
  return { label: "veryChallenging", color: "text-destructive" };
}

export function NewChallengeClient({
  currentRank,
  availableTopics,
  playerStats,
}: NewChallengeClientProps) {
  const t = useTranslations("Challenges");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Wizard state
  const [step, setStep] = useState<WizardStep>("type");
  const [challengeType, setChallengeType] = useState<"by-date" | "by-games" | null>(null);

  // Shared state
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);

  // By-date state
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");

  // By-games state
  const [metric, setMetric] = useState<string>("");
  const [condition, setCondition] = useState<string>("");
  const [threshold, setThreshold] = useState<string>("");
  const [targetGames, setTargetGames] = useState<string>("10");

  // By-date validation
  const selectedTierIdx = TIER_ORDER.indexOf(
    selectedTier.toUpperCase() as (typeof TIER_ORDER)[number],
  );
  const isMasterPlus = selectedTierIdx >= MASTER_PLUS_INDEX;

  const currentCumLP = currentRank
    ? toCumulativeLP(currentRank.tier, currentRank.division, currentRank.lp)
    : null;
  const targetCumLP = selectedTier
    ? toCumulativeLP(selectedTier, isMasterPlus ? null : selectedDivision || "IV", 0)
    : null;

  const isTargetHigher =
    currentCumLP !== null && targetCumLP !== null && targetCumLP > currentCumLP;

  const canSubmitByDate =
    selectedTier !== "" &&
    (isMasterPlus || selectedDivision !== "") &&
    (currentRank === null || isTargetHigher);

  // Auto-generated title for by-games
  const autoTitle = useMemo(() => {
    if (!metric || !condition || !threshold) return "";
    const metricLabel = METRIC_LABELS[metric] ?? metric;
    const condLabel =
      condition === "at_least" ? t("conditionOptions.atLeast") : t("conditionOptions.atMost");
    return `${condLabel} ${threshold} ${metricLabel.toLowerCase()} over ${targetGames || "?"} games`;
  }, [metric, condition, threshold, targetGames, t]);

  const canSubmitByGames =
    metric !== "" &&
    condition !== "" &&
    threshold !== "" &&
    Number(threshold) > 0 &&
    targetGames !== "" &&
    Number(targetGames) > 0;

  // Difficulty indicator
  const difficulty = useMemo(() => {
    if (!metric || !condition || !threshold || Number(threshold) <= 0) return null;
    return getDifficulty(metric, condition, Number(threshold), playerStats);
  }, [metric, condition, threshold, playerStats]);

  // Player average for selected metric
  const playerAvg = useMemo(() => {
    if (!metric || playerStats.totalGames < 1) return null;
    if (metric === "cspm") return playerStats.cspm;
    if (metric === "deaths") return playerStats.deaths;
    if (metric === "vision_score") return playerStats.visionScore;
    return null;
  }, [metric, playerStats]);

  function toggleTopic(id: number) {
    setSelectedTopicIds((prev) =>
      prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id],
    );
  }

  function resetWizard() {
    setStep("type");
    setChallengeType(null);
    setSelectedTopicIds([]);
    setSelectedTier("");
    setSelectedDivision("");
    setDeadline("");
    setMetric("");
    setCondition("");
    setThreshold("");
    setTargetGames("10");
  }

  function handleSubmit() {
    if (challengeType === "by-date") {
      if (!canSubmitByDate) return;
      startTransition(async () => {
        try {
          const result = await createByDateChallenge({
            targetTier: selectedTier.toUpperCase(),
            targetDivision: isMasterPlus ? null : selectedDivision,
            deadline: deadline || null,
            topicIds: selectedTopicIds,
          });
          if ("error" in result && result.error) {
            toast.error(result.error);
          } else {
            toast.success(t("toasts.challengeCreated"));
            resetWizard();
            router.push("/challenges");
          }
        } catch {
          toast.error(t("toasts.createError"));
        }
      });
    } else if (challengeType === "by-games") {
      if (!canSubmitByGames) return;
      startTransition(async () => {
        try {
          const result = await createByGamesChallenge({
            title: autoTitle,
            metric: metric as ChallengeMetric,
            metricCondition: condition as MetricCondition,
            metricThreshold: Number(threshold),
            targetGames: Number(targetGames),
            topicIds: selectedTopicIds,
          });
          if ("error" in result) {
            toast.error(String(result.error));
          } else {
            toast.success(t("toasts.challengeCreated"));
            resetWizard();
            router.push("/challenges");
          }
        } catch {
          toast.error(t("toasts.createError"));
        }
      });
    }
  }

  const canProceedFromConfig = challengeType === "by-date" ? canSubmitByDate : canSubmitByGames;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-teal">{t("newChallengeTitle")}</h1>
          <p className="text-muted-foreground">{t("newChallengeSubtitle")}</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        <StepIndicator
          label={t("wizardStepType")}
          stepNumber={1}
          active={step === "type"}
          completed={step !== "type"}
        />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <StepIndicator
          label={t("wizardStepConfig")}
          stepNumber={2}
          active={step === "config"}
          completed={step === "topics"}
        />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <StepIndicator
          label={t("wizardStepTopics")}
          stepNumber={3}
          active={step === "topics"}
          completed={false}
        />
      </div>

      {/* No rank data warning */}
      {!currentRank && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{t("noRankData")}</span>
        </div>
      )}

      {/* Step 1: Choose type */}
      {step === "type" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            className={`cursor-pointer transition-all hover:border-gold/40 ${challengeType === "by-date" ? "border-gold/60 ring-1 ring-gold/30" : ""}`}
            onClick={() => setChallengeType("by-date")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5 text-gold" />
                {t("byDateTab")}
              </CardTitle>
              <CardDescription>{t("byDateDescription")}</CardDescription>
            </CardHeader>
          </Card>
          <Card
            className={`cursor-pointer transition-all hover:border-gold/40 ${challengeType === "by-games" ? "border-gold/60 ring-1 ring-gold/30" : ""}`}
            onClick={() => setChallengeType("by-games")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gamepad2 className="h-5 w-5 text-gold" />
                {t("byGamesTab")}
              </CardTitle>
              <CardDescription>{t("byGamesDescription")}</CardDescription>
            </CardHeader>
          </Card>
          <div className="flex gap-3 sm:col-span-2">
            <Link href="/challenges">
              <Button variant="outline">{t("cancel")}</Button>
            </Link>
            <Button disabled={!challengeType} onClick={() => setStep("config")}>
              {t("wizardNext")}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {step === "config" && challengeType === "by-date" && (
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-gold" />
              {t("targetRank")}
            </CardTitle>
            <CardDescription>{t("targetRankDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current rank context */}
            {currentRank && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  {t("currentRankLabel")}:{" "}
                  <span className="font-medium text-foreground">
                    {formatTierDivision(currentRank.tier, currentRank.division)} — {currentRank.lp}{" "}
                    LP
                  </span>
                </p>
              </div>
            )}

            {/* Tier + Division in a row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("tier")}</Label>
                <Select
                  value={selectedTier}
                  onValueChange={(v) => {
                    if (!v) return;
                    setSelectedTier(v);
                    const idx = TIER_ORDER.indexOf(v.toUpperCase() as (typeof TIER_ORDER)[number]);
                    if (idx >= MASTER_PLUS_INDEX) {
                      setSelectedDivision("");
                    }
                  }}
                >
                  <SelectTrigger aria-label={t("selectTier")}>
                    <SelectValue placeholder={t("selectTier")}>
                      {selectedTier ? formatTierLabel(selectedTier) : t("selectTier")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TIER_ORDER.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {formatTierLabel(tier)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTier && !isMasterPlus && (
                <div className="space-y-2">
                  <Label>{t("division")}</Label>
                  <Select
                    value={selectedDivision}
                    onValueChange={(v) => v && setSelectedDivision(v)}
                  >
                    <SelectTrigger aria-label={t("selectDivision")}>
                      <SelectValue placeholder={t("selectDivision")}>
                        {selectedDivision || t("selectDivision")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {DIVISION_ORDER.map((div) => (
                        <SelectItem key={div} value={div}>
                          {div}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Target preview */}
            {selectedTier && (isMasterPlus || selectedDivision) && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm">
                  {t("challengePreview")}:{" "}
                  <span className="font-semibold text-gold">
                    {t("reachTarget", {
                      target: formatTierDivision(
                        selectedTier.toUpperCase(),
                        isMasterPlus ? null : selectedDivision,
                      ),
                    })}
                  </span>
                </p>
              </div>
            )}

            {/* Validation error */}
            {selectedTier &&
              (isMasterPlus || selectedDivision) &&
              currentRank &&
              !isTargetHigher && (
                <p className="text-sm text-destructive">{t("targetMustBeHigher")}</p>
              )}

            {/* Optional deadline */}
            <div className="space-y-2">
              <Label>{t("deadlineLabel")}</Label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
              <p className="text-xs text-muted-foreground">{t("deadlineHelp")}</p>
            </div>

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep("type")}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t("wizardBack")}
              </Button>
              <Button disabled={!canSubmitByDate} onClick={() => setStep("topics")}>
                {t("wizardNext")}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "config" && challengeType === "by-games" && (
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-gold" />
              {t("byGamesTab")}
            </CardTitle>
            <CardDescription>{t("byGamesConfigDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Metric + Condition in a row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("metric")}</Label>
                <Select value={metric} onValueChange={(v) => v && setMetric(v)}>
                  <SelectTrigger aria-label={t("selectMetric")}>
                    <SelectValue placeholder={t("selectMetric")}>
                      {metric ? (METRIC_LABELS[metric] ?? metric) : t("selectMetric")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cspm">{t("metricOptions.cspm")}</SelectItem>
                    <SelectItem value="deaths">{t("metricOptions.deaths")}</SelectItem>
                    <SelectItem value="vision_score">{t("metricOptions.visionScore")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("condition")}</Label>
                <Select value={condition} onValueChange={(v) => v && setCondition(v)}>
                  <SelectTrigger aria-label={t("selectCondition")}>
                    <SelectValue placeholder={t("selectCondition")}>
                      {condition === "at_least"
                        ? t("conditionOptions.atLeast")
                        : condition === "at_most"
                          ? t("conditionOptions.atMost")
                          : t("selectCondition")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="at_least">{t("conditionOptions.atLeast")}</SelectItem>
                    <SelectItem value="at_most">{t("conditionOptions.atMost")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Threshold + Games in a row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("threshold")}</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder={playerAvg != null ? String(playerAvg) : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("targetGames")}</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={targetGames}
                  onChange={(e) => setTargetGames(e.target.value)}
                />
              </div>
            </div>

            {/* Player average stats hint */}
            {metric && playerAvg != null && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  {t("yourAverage", {
                    metric: METRIC_LABELS[metric] ?? metric,
                    value: playerAvg,
                    games: playerStats.totalGames,
                  })}
                </p>
              </div>
            )}

            {/* Difficulty indicator */}
            {difficulty && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className={`text-sm font-medium ${difficulty.color}`}>
                  {t(`difficulty.${difficulty.label}`)}
                </p>
              </div>
            )}

            {/* Auto-generated title preview */}
            {autoTitle && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm">
                  {t("challengePreview")}:{" "}
                  <span className="font-semibold text-gold">{autoTitle}</span>
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep("type")}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t("wizardBack")}
              </Button>
              <Button disabled={!canSubmitByGames} onClick={() => setStep("topics")}>
                {t("wizardNext")}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Topics + Submit */}
      {step === "topics" && (
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle>{t("topicsLabel")}</CardTitle>
            <CardDescription>{t("topicsHelp")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableTopics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availableTopics.map((topic) => (
                  <Badge
                    key={topic.id}
                    variant={selectedTopicIds.includes(topic.id) ? "default" : "outline"}
                    className="cursor-pointer px-3 py-1.5 text-sm"
                    onClick={() => toggleTopic(topic.id)}
                  >
                    {topic.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noTopicsAvailable")}</p>
            )}

            {/* Summary */}
            <div className="rounded-lg border border-gold/20 bg-gold/5 p-4">
              <p className="text-sm font-medium text-gold">{t("challengeSummary")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {challengeType === "by-date"
                  ? t("reachTarget", {
                      target: formatTierDivision(
                        selectedTier.toUpperCase(),
                        isMasterPlus ? null : selectedDivision,
                      ),
                    }) + (deadline ? ` — ${t("deadline", { date: deadline })}` : "")
                  : autoTitle}
              </p>
              {selectedTopicIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedTopicIds.map((id) => {
                    const topic = availableTopics.find((t) => t.id === id);
                    return topic ? (
                      <Badge key={id} variant="secondary" className="text-xs">
                        {topic.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* Navigation + Submit */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep("config")}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t("wizardBack")}
              </Button>
              <Button disabled={!canProceedFromConfig || isPending} onClick={handleSubmit}>
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : challengeType === "by-date" ? (
                  <Target className="mr-2 h-4 w-4" />
                ) : (
                  <Gamepad2 className="mr-2 h-4 w-4" />
                )}
                {t("createChallenge")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Step indicator component ─────────────────────────────────────────────

function StepIndicator({
  label,
  stepNumber,
  active,
  completed,
}: {
  label: string;
  stepNumber: number;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
          active
            ? "text-gold-foreground bg-gold"
            : completed
              ? "bg-gold/20 text-gold"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {stepNumber}
      </div>
      <span
        className={`text-sm ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </span>
    </div>
  );
}

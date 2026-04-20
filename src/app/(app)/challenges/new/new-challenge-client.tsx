"use client";

import { Target, Loader2, AlertCircle, Gamepad2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TIER_ORDER, DIVISION_ORDER, formatTierDivision, toCumulativeLP } from "@/lib/rank";

interface NewChallengeClientProps {
  currentRank: {
    tier: string;
    division: string | null;
    lp: number;
  } | null;
  availableTopics: { id: number; name: string }[];
}

const MASTER_PLUS_INDEX = TIER_ORDER.indexOf("MASTER");

export function NewChallengeClient({ currentRank, availableTopics }: NewChallengeClientProps) {
  const t = useTranslations("Challenges");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Shared state
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);

  // By-date state
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");

  // By-games state
  const [challengeTitle, setChallengeTitle] = useState<string>("");
  const [metric, setMetric] = useState<string>("");
  const [condition, setCondition] = useState<string>("");
  const [threshold, setThreshold] = useState<string>("");
  const [targetGames, setTargetGames] = useState<string>("");

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

  const canSubmitByGames =
    challengeTitle.trim() !== "" &&
    metric !== "" &&
    condition !== "" &&
    threshold !== "" &&
    Number(threshold) > 0 &&
    targetGames !== "" &&
    Number(targetGames) > 0;

  function toggleTopic(id: number) {
    setSelectedTopicIds((prev) =>
      prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id],
    );
  }

  function handleByDateSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          router.push("/challenges");
        }
      } catch {
        toast.error(t("toasts.createError"));
      }
    });
  }

  function handleByGamesSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitByGames) return;

    startTransition(async () => {
      try {
        const result = await createByGamesChallenge({
          title: challengeTitle.trim(),
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
          router.push("/challenges");
        }
      } catch {
        toast.error(t("toasts.createError"));
      }
    });
  }

  const topicsSelector = availableTopics.length > 0 && (
    <div className="space-y-2">
      <Label>{t("topicsLabel")}</Label>
      <div className="flex flex-wrap gap-1.5">
        {availableTopics.map((topic) => (
          <Badge
            key={topic.id}
            variant={selectedTopicIds.includes(topic.id) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggleTopic(topic.id)}
          >
            {topic.name}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("topicsHelp")}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">
            {t("newChallengeTitle")}
          </h1>
          <p className="text-muted-foreground">{t("newChallengeSubtitle")}</p>
        </div>
      </div>

      {/* No rank data warning */}
      {!currentRank && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{t("noRankData")}</span>
        </div>
      )}

      {/* Current rank context */}
      {currentRank && (
        <Card size="sm">
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">
              {t("currentRankLabel")}:{" "}
              <span className="font-medium text-foreground">
                {formatTierDivision(currentRank.tier, currentRank.division)} — {currentRank.lp} LP
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabbed form */}
      <Tabs defaultValue="by-date">
        <TabsList>
          <TabsTrigger value="by-date">
            <Target className="mr-1.5 h-4 w-4" />
            {t("byDateTab")}
          </TabsTrigger>
          <TabsTrigger value="by-games">
            <Gamepad2 className="mr-1.5 h-4 w-4" />
            {t("byGamesTab")}
          </TabsTrigger>
        </TabsList>

        {/* ── By Date Tab ── */}
        <TabsContent value="by-date">
          <form onSubmit={handleByDateSubmit}>
            <Card className="surface-glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-gold" />
                  {t("targetRank")}
                </CardTitle>
                <CardDescription>{t("targetRankDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tier picker */}
                <div className="space-y-2">
                  <Label>{t("tier")}</Label>
                  <Select
                    value={selectedTier}
                    onValueChange={(v) => {
                      if (!v) return;
                      setSelectedTier(v);
                      const idx = TIER_ORDER.indexOf(
                        v.toUpperCase() as (typeof TIER_ORDER)[number],
                      );
                      if (idx >= MASTER_PLUS_INDEX) {
                        setSelectedDivision("");
                      }
                    }}
                  >
                    <SelectTrigger aria-label="Select tier">
                      <SelectValue placeholder={t("selectTier")} />
                    </SelectTrigger>
                    <SelectContent>
                      {TIER_ORDER.map((tier) => (
                        <SelectItem key={tier} value={tier}>
                          {tier.charAt(0) + tier.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Division picker */}
                {selectedTier && !isMasterPlus && (
                  <div className="space-y-2">
                    <Label>{t("division")}</Label>
                    <Select
                      value={selectedDivision}
                      onValueChange={(v) => v && setSelectedDivision(v)}
                    >
                      <SelectTrigger aria-label="Select division">
                        <SelectValue placeholder={t("selectDivision")} />
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

                {/* Topics */}
                {topicsSelector}

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={!canSubmitByDate || isPending}>
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Target className="mr-2 h-4 w-4" />
                    )}
                    {t("createChallenge")}
                  </Button>
                  <Link href="/challenges">
                    <Button type="button" variant="outline">
                      {t("cancel")}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* ── By Games Tab ── */}
        <TabsContent value="by-games">
          <form onSubmit={handleByGamesSubmit}>
            <Card className="surface-glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5 text-gold" />
                  {t("byGamesTab")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Title */}
                <div className="space-y-2">
                  <Label>{t("challengeTitle")}</Label>
                  <Input
                    value={challengeTitle}
                    onChange={(e) => setChallengeTitle(e.target.value)}
                    placeholder="Keep CS/min above 7 for 10 games"
                  />
                </div>

                {/* Metric */}
                <div className="space-y-2">
                  <Label>{t("metric")}</Label>
                  <Select value={metric} onValueChange={(v) => v && setMetric(v)}>
                    <SelectTrigger aria-label="Select metric">
                      <SelectValue placeholder={t("selectMetric")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cspm">{t("metricOptions.cspm")}</SelectItem>
                      <SelectItem value="deaths">{t("metricOptions.deaths")}</SelectItem>
                      <SelectItem value="vision_score">{t("metricOptions.visionScore")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Condition */}
                <div className="space-y-2">
                  <Label>{t("condition")}</Label>
                  <Select value={condition} onValueChange={(v) => v && setCondition(v)}>
                    <SelectTrigger aria-label="Select condition">
                      <SelectValue placeholder={t("selectCondition")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">{t("conditionOptions.above")}</SelectItem>
                      <SelectItem value="below">{t("conditionOptions.below")}</SelectItem>
                      <SelectItem value="at_least">{t("conditionOptions.atLeast")}</SelectItem>
                      <SelectItem value="at_most">{t("conditionOptions.atMost")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Threshold */}
                <div className="space-y-2">
                  <Label>{t("threshold")}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </div>

                {/* Target games */}
                <div className="space-y-2">
                  <Label>{t("targetGames")}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={targetGames}
                    onChange={(e) => setTargetGames(e.target.value)}
                  />
                </div>

                {/* Topics */}
                {topicsSelector}

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={!canSubmitByGames || isPending}>
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Gamepad2 className="mr-2 h-4 w-4" />
                    )}
                    {t("createChallenge")}
                  </Button>
                  <Link href="/challenges">
                    <Button type="button" variant="outline">
                      {t("cancel")}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

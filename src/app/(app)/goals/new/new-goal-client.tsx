"use client";

import { Target, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createGoal } from "@/app/actions/goals";
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

interface NewGoalClientProps {
  currentRank: {
    tier: string;
    division: string | null;
    lp: number;
  } | null;
}

const MASTER_PLUS_INDEX = TIER_ORDER.indexOf("MASTER");

export function NewGoalClient({ currentRank }: NewGoalClientProps) {
  const t = useTranslations("Goals");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedTier, setSelectedTier] = useState<string>("");
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");

  // Determine if selected tier is Master+ (no divisions)
  const selectedTierIdx = TIER_ORDER.indexOf(
    selectedTier.toUpperCase() as (typeof TIER_ORDER)[number],
  );
  const isMasterPlus = selectedTierIdx >= MASTER_PLUS_INDEX;

  // Validate: target must be higher than current rank
  const currentCumLP = currentRank
    ? toCumulativeLP(currentRank.tier, currentRank.division, currentRank.lp)
    : null;
  const targetCumLP = selectedTier
    ? toCumulativeLP(selectedTier, isMasterPlus ? null : selectedDivision || "IV", 0)
    : null;

  const isTargetHigher =
    currentCumLP !== null && targetCumLP !== null && targetCumLP > currentCumLP;

  const canSubmit =
    selectedTier !== "" &&
    (isMasterPlus || selectedDivision !== "") &&
    (currentRank === null || isTargetHigher);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    startTransition(async () => {
      try {
        const result = await createGoal({
          targetTier: selectedTier.toUpperCase(),
          targetDivision: isMasterPlus ? null : selectedDivision,
          deadline: deadline || null,
        });
        if ("error" in result && result.error) {
          toast.error(result.error);
        } else {
          toast.success(t("toasts.goalCreated"));
          router.push("/goals");
        }
      } catch {
        toast.error(t("toasts.createError"));
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/goals">
          <Button variant="ghost" size="icon" aria-label="Back to goals">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">
            {t("newGoalTitle")}
          </h1>
          <p className="text-muted-foreground">{t("newGoalSubtitle")}</p>
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

      {/* Form */}
      <form onSubmit={handleSubmit}>
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
                  // Clear division when switching to Master+
                  const idx = TIER_ORDER.indexOf(v.toUpperCase() as (typeof TIER_ORDER)[number]);
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

            {/* Division picker (hidden for Master+) */}
            {selectedTier && !isMasterPlus && (
              <div className="space-y-2">
                <Label>{t("division")}</Label>
                <Select value={selectedDivision} onValueChange={(v) => v && setSelectedDivision(v)}>
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
                  {t("goalPreview")}:{" "}
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

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={!canSubmit || isPending}>
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Target className="mr-2 h-4 w-4" />
                )}
                {t("createGoal")}
              </Button>
              <Link href="/goals">
                <Button type="button" variant="outline">
                  {t("cancel")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

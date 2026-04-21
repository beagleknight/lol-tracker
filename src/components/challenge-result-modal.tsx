"use client";

import confetti from "canvas-confetti";
import { Trophy, XCircle, ChevronLeft, ChevronRight, RotateCcw, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useRef, useTransition } from "react";
import { toast } from "sonner";

import type { ChallengeTransition } from "@/lib/challenges";

import { retryChallenge } from "@/app/actions/challenges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ChallengeResultModalProps {
  transitions: ChallengeTransition[];
  onDismiss: () => void;
}

function formatMetricLabel(metric: string | null | undefined): string {
  switch (metric) {
    case "cspm":
      return "CS/min";
    case "deaths":
      return "Deaths";
    case "vision_score":
      return "Vision score";
    default:
      return metric ?? "";
  }
}

function formatCondition(condition: string | null | undefined): string {
  switch (condition) {
    case "at_least":
      return "≥";
    case "at_most":
      return "≤";
    default:
      return "";
  }
}

export function ChallengeResultModal({ transitions, onDismiss }: ChallengeResultModalProps) {
  const t = useTranslations("ChallengeResult");
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const confettiFiredRef = useRef<Set<number>>(new Set());

  // Sort: successes first, then failures
  const sorted = [...transitions].sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return -1;
    if (a.status !== "completed" && b.status === "completed") return 1;
    return 0;
  });

  const current = sorted[currentIndex];
  const isSuccess = current?.status === "completed";
  const total = sorted.length;

  // Fire confetti for success transitions
  const fireConfetti = useCallback(() => {
    if (!current || !isSuccess) return;
    if (confettiFiredRef.current.has(current.id)) return;
    confettiFiredRef.current.add(current.id);

    // Gold/yellow confetti burst
    const fire = (particleRatio: number, opts: confetti.Options) => {
      void confetti({
        origin: { y: 0.7 },
        ...opts,
        particleCount: Math.floor(200 * particleRatio),
      });
    };

    fire(0.25, { spread: 26, startVelocity: 55, colors: ["#FFD700", "#FFA500"] });
    fire(0.2, { spread: 60, colors: ["#FFD700", "#FFA500", "#FF6347"] });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ["#FFD700", "#FFA500", "#fff"] });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, colors: ["#FFD700"] });
    fire(0.1, { spread: 120, startVelocity: 45, colors: ["#FFA500", "#FFD700"] });
  }, [current, isSuccess]);

  useEffect(() => {
    if (transitions.length > 0 && isSuccess) {
      // Small delay so the modal animation finishes first
      const timer = setTimeout(fireConfetti, 300);
      return () => clearTimeout(timer);
    }
  }, [transitions.length, isSuccess, fireConfetti]);

  const goNext = useCallback(() => {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, total]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  const tChallenges = useTranslations("Challenges");
  const [isRetrying, startRetry] = useTransition();

  const handleTryAgain = useCallback(() => {
    startRetry(async () => {
      try {
        const result = await retryChallenge(current.id);
        if ("error" in result) {
          toast.error(result.error);
        } else {
          toast.success(tChallenges("toasts.challengeRetried"));
          onDismiss();
          router.push("/challenges");
        }
      } catch {
        toast.error(tChallenges("toasts.retryError"));
      }
    });
  }, [current, onDismiss, router, tChallenges]);

  if (!current) return null;

  return (
    <Dialog
      open={transitions.length > 0}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <DialogContent
        className={cn(
          "sm:max-w-md",
          isSuccess
            ? "bg-gradient-to-b from-win/5 to-background ring-win/30"
            : "ring-destructive/30",
        )}
        showCloseButton={false}
      >
        <DialogHeader className="items-center text-center">
          {/* Icon */}
          <div
            className={cn(
              "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
              isSuccess
                ? "animate-in bg-win/15 text-win duration-500 zoom-in-50"
                : "animate-in bg-destructive/15 text-destructive duration-500 zoom-in-50",
            )}
          >
            {isSuccess ? <Trophy className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
          </div>

          {/* Title */}
          <DialogTitle className={cn("text-xl", isSuccess ? "text-win" : "text-destructive")}>
            {isSuccess ? t("successTitle") : t("failureTitle")}
          </DialogTitle>

          {/* Challenge name */}
          <DialogDescription className="text-base font-medium text-foreground">
            {current.title}
          </DialogDescription>
        </DialogHeader>

        {/* Stats */}
        <div
          className={cn(
            "rounded-lg border p-4 text-center text-sm",
            isSuccess ? "border-win/20 bg-win/5" : "border-destructive/20 bg-destructive/5",
          )}
        >
          {current.type === "by-games" && current.metric && (
            <p className="text-muted-foreground">
              {formatMetricLabel(current.metric)} {formatCondition(current.metricCondition)}{" "}
              {current.metricThreshold}
              <span className="mx-2">·</span>
              <span className={cn("font-semibold", isSuccess ? "text-win" : "text-destructive")}>
                {current.successfulGames}/{current.targetGames}
              </span>{" "}
              {t("gamesPassedLabel")}
            </p>
          )}
          {current.type === "by-date" && current.targetTier && (
            <p className="text-muted-foreground">
              {t("reachTarget", {
                target: `${current.targetTier} ${current.targetDivision ?? ""}`.trim(),
              })}
            </p>
          )}
        </div>

        {/* Encouragement text */}
        <p className="text-center text-sm text-muted-foreground">
          {isSuccess ? t("successMessage") : t("failureMessage")}
        </p>

        {/* Pagination indicator */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={goPrev}
              disabled={currentIndex === 0}
              aria-label={t("previous")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentIndex + 1} / {total}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={goNext}
              disabled={currentIndex === total - 1}
              aria-label={t("next")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <DialogFooter className="sm:justify-center">
          {!isSuccess && (
            <Button
              variant="outline"
              onClick={handleTryAgain}
              disabled={isRetrying}
              className="gap-2"
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {t("tryAgain")}
            </Button>
          )}
          <Button
            onClick={onDismiss}
            className={cn(isSuccess && "bg-win text-white hover:bg-win/90")}
          >
            {isSuccess ? t("dismissSuccess") : t("dismissFailure")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

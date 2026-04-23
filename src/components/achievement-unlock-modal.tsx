"use client";

import confetti from "canvas-confetti";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useRef } from "react";

import type { AchievementTransition } from "@/lib/achievements";

import { AchievementBadge } from "@/components/achievement-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAchievementById, getTierName } from "@/lib/achievements";
import { cn } from "@/lib/utils";

export interface AchievementUnlockModalProps {
  transitions: AchievementTransition[];
  onDismiss: () => void;
}

const TIER_LABEL_KEYS: Record<string, string> = {
  iron: "tierIron",
  bronze: "tierBronze",
  silver: "tierSilver",
  gold: "tierGold",
  platinum: "tierPlatinum",
  diamond: "tierDiamond",
};

const BACKFILL_THRESHOLD = 3;

export function AchievementUnlockModal({ transitions, onDismiss }: AchievementUnlockModalProps) {
  const t = useTranslations("Achievements");
  const [currentIndex, setCurrentIndex] = useState(0);
  const confettiFiredRef = useRef(false);

  const total = transitions.length;
  const isBackfill = total >= BACKFILL_THRESHOLD;
  const isLastPage = currentIndex === total - 1;
  const current = transitions[currentIndex];
  const def = current ? getAchievementById(current.achievementId) : null;

  // Confetti only on the very first achievement unlock ever (index 0, first time)
  useEffect(() => {
    if (transitions.length > 0 && !confettiFiredRef.current) {
      confettiFiredRef.current = true;

      const fire = (particleRatio: number, opts: confetti.Options) => {
        void confetti({
          origin: { y: 0.7 },
          ...opts,
          particleCount: Math.floor(200 * particleRatio),
        });
      };

      const timer = setTimeout(() => {
        fire(0.25, { spread: 26, startVelocity: 55, colors: ["#FFD700", "#FFA500"] });
        fire(0.2, { spread: 60, colors: ["#FFD700", "#FFA500", "#FF6347"] });
        fire(0.35, {
          spread: 100,
          decay: 0.91,
          scalar: 0.8,
          colors: ["#FFD700", "#FFA500", "#fff"],
        });
        fire(0.1, {
          spread: 120,
          startVelocity: 25,
          decay: 0.92,
          scalar: 1.2,
          colors: ["#FFD700"],
        });
        fire(0.1, { spread: 120, startVelocity: 45, colors: ["#FFA500", "#FFD700"] });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [transitions.length]);

  const goNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  if (!current || !def) return null;

  const isTierUp = current.type === "tier_up";
  const tierLabel = current.tier
    ? t(TIER_LABEL_KEYS[getTierName(current.tier)]! as Parameters<typeof t>[0])
    : null;

  return (
    <Dialog
      open={transitions.length > 0}
      onOpenChange={(open) => {
        if (!open && isLastPage) onDismiss();
      }}
    >
      <DialogContent
        className="bg-gradient-to-b from-gold/5 to-background ring-gold/30 sm:max-w-md"
        showCloseButton={false}
      >
        <DialogHeader className="items-center text-center">
          {/* Badge */}
          <div className="mx-auto animate-in duration-500 zoom-in-50">
            <AchievementBadge
              icon={def.icon}
              category={def.category}
              unlocked={true}
              secret={def.secret}
              tier={current.tier}
              size="lg"
            />
          </div>

          {/* Title */}
          <DialogTitle className="text-xl text-gold">
            {isBackfill && currentIndex === 0
              ? t("unlockModal.backfillTitle")
              : isTierUp
                ? t("unlockModal.tierUpTitle")
                : t("unlockModal.title")}
          </DialogTitle>

          {/* Achievement name */}
          <DialogDescription className="text-base font-medium text-foreground">
            {t(`${def.id}.title` as Parameters<typeof t>[0])}
          </DialogDescription>
        </DialogHeader>

        {/* Details */}
        <div className="rounded-lg border border-gold/20 bg-gold/5 p-4 text-center text-sm">
          <p className="text-muted-foreground">
            {t(`${def.id}.description` as Parameters<typeof t>[0])}
          </p>
          {tierLabel && (
            <p className="mt-2 font-semibold text-gold">
              {t("unlockModal.newTier", { tier: tierLabel })}
            </p>
          )}
        </div>

        {/* Backfill explanation for first card */}
        {isBackfill && currentIndex === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {t("unlockModal.backfillDescription")}
          </p>
        )}

        {/* Pagination */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={goPrev}
              disabled={currentIndex === 0}
              aria-label={t("unlockModal.previous")}
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
              aria-label={t("unlockModal.next")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <DialogFooter className="sm:justify-center">
          {isLastPage ? (
            <Button onClick={onDismiss} className={cn("bg-gold text-white hover:bg-gold/90")}>
              {t("unlockModal.dismiss")}
            </Button>
          ) : (
            <Button onClick={goNext} className={cn("bg-gold text-white hover:bg-gold/90")}>
              {t("unlockModal.nextPage")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

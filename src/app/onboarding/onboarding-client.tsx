"use client";

import { CheckCircle2, Globe, Loader2, Gamepad2, Shield, Swords } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { completeOnboarding } from "@/app/actions/onboarding";
import { linkRiotAccount, updateRolePreferences } from "@/app/actions/settings";
import { PositionIcon, POSITIONS, type Position } from "@/components/position-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSyncMatches, type SyncProgress } from "@/hooks/use-sync-matches";
import { useAuth } from "@/lib/auth-client";
import { PLATFORM_IDS, PLATFORM_LABELS } from "@/lib/riot-api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  initialRegion: string | null;
  initialGameName: string | null;
  initialTagLine: string | null;
  initialPrimaryRole: string | null;
  initialSecondaryRole: string | null;
  isLinked: boolean;
}

const TOTAL_STEPS = 4;

// ─── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({
  currentStep,
  t,
}: {
  currentStep: number;
  t: ReturnType<typeof useTranslations<"Onboarding">>;
}) {
  const percentage = (currentStep / TOTAL_STEPS) * 100;
  return (
    <Progress
      value={percentage}
      aria-label={t("step", { current: currentStep, total: TOTAL_STEPS })}
    >
      <ProgressLabel className="text-muted-foreground">
        {t("step", { current: currentStep, total: TOTAL_STEPS })}
      </ProgressLabel>
      <ProgressValue>{(formattedValue) => formattedValue}</ProgressValue>
    </Progress>
  );
}

// ─── Step 1: Region ─────────────────────────────────────────────────────────

function RegionStep({
  region,
  onRegionChange,
  t,
}: {
  region: string | null;
  onRegionChange: (region: string) => void;
  t: ReturnType<typeof useTranslations<"Onboarding">>;
}) {
  return (
    <div className="animate-in-up space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
          <Globe className="h-6 w-6 text-gold" />
        </div>
        <h2 className="text-xl font-semibold">{t("region.heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("region.description")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="onboarding-region">{t("region.label")}</Label>
        <Select
          value={region}
          onValueChange={(v) => {
            if (v) onRegionChange(v);
          }}
        >
          <SelectTrigger id="onboarding-region" className="w-full" aria-label={t("region.label")}>
            <SelectValue placeholder={t("region.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {PLATFORM_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {PLATFORM_LABELS[id]} ({id})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─── Step 2: Riot Account ───────────────────────────────────────────────────

function RiotAccountStep({
  riotId,
  onRiotIdChange,
  onLink,
  isPending,
  linked,
  linkedName,
  t,
}: {
  riotId: string;
  onRiotIdChange: (value: string) => void;
  onLink: () => void;
  isPending: boolean;
  linked: boolean;
  linkedName: string | null;
  t: ReturnType<typeof useTranslations<"Onboarding">>;
}) {
  return (
    <div className="animate-in-up space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
          <Gamepad2 className="h-6 w-6 text-gold" />
        </div>
        <h2 className="text-xl font-semibold">{t("riotAccount.heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("riotAccount.description")}</p>
      </div>
      {linked && linkedName ? (
        <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
          <div>
            <p className="font-medium">{t("riotAccount.linked")}</p>
            <p className="text-sm text-muted-foreground">{linkedName}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="onboarding-riot-id">{t("riotAccount.riotIdLabel")}</Label>
            <Input
              id="onboarding-riot-id"
              value={riotId}
              onChange={(e) => onRiotIdChange(e.target.value)}
              placeholder={t("riotAccount.riotIdPlaceholder")}
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onLink();
                }
              }}
            />
          </div>
          <Button onClick={onLink} disabled={isPending || !riotId.includes("#")} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("riotAccount.linking")}
              </>
            ) : (
              t("riotAccount.linkButton")
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Role preferences ───────────────────────────────────────────────

function RolesStep({
  primaryRole,
  secondaryRole,
  onPrimaryChange,
  onSecondaryChange,
  t,
}: {
  primaryRole: string;
  secondaryRole: string;
  onPrimaryChange: (role: string) => void;
  onSecondaryChange: (role: string) => void;
  t: ReturnType<typeof useTranslations<"Onboarding">>;
}) {
  return (
    <div className="animate-in-up space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
          <Swords className="h-6 w-6 text-gold" />
        </div>
        <h2 className="text-xl font-semibold">{t("roles.heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("roles.description")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="onboarding-primary-role">{t("roles.primaryLabel")}</Label>
          <Select
            value={primaryRole}
            onValueChange={(v) => {
              if (v) onPrimaryChange(v);
            }}
          >
            <SelectTrigger
              id="onboarding-primary-role"
              className="w-full"
              aria-label={t("roles.primaryLabel")}
            >
              <SelectValue placeholder={t("roles.placeholder")}>
                {primaryRole && (
                  <span className="inline-flex items-center gap-2">
                    <PositionIcon position={primaryRole} size={14} />
                    {t(`roles.positions.${primaryRole}`)}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {POSITIONS.map((pos) => (
                <SelectItem key={pos} value={pos}>
                  <span className="flex items-center gap-2">
                    <PositionIcon position={pos} size={14} />
                    {t(`roles.positions.${pos}`)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="onboarding-secondary-role">{t("roles.secondaryLabel")}</Label>
          <Select
            value={secondaryRole}
            onValueChange={(v) => {
              if (v) onSecondaryChange(v);
            }}
          >
            <SelectTrigger
              id="onboarding-secondary-role"
              className="w-full"
              aria-label={t("roles.secondaryLabel")}
            >
              <SelectValue placeholder={t("roles.nonePlaceholder")}>
                {secondaryRole && secondaryRole !== "none" && (
                  <span className="inline-flex items-center gap-2">
                    <PositionIcon position={secondaryRole} size={14} />
                    {t(`roles.positions.${secondaryRole}`)}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("roles.nonePlaceholder")}</SelectItem>
              {POSITIONS.filter((pos) => pos !== primaryRole).map((pos) => (
                <SelectItem key={pos} value={pos}>
                  <span className="flex items-center gap-2">
                    <PositionIcon position={pos} size={14} />
                    {t(`roles.positions.${pos}`)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Sync + Complete ────────────────────────────────────────────────

function SyncStep({
  syncState,
  progress,
  onSync,
  onComplete,
  isPending,
  t,
}: {
  syncState: "idle" | "syncing" | "done" | "error";
  progress: SyncProgress | null;
  onSync: () => void;
  onComplete: () => void;
  isPending: boolean;
  t: ReturnType<typeof useTranslations<"Onboarding">>;
}) {
  const syncPercentage =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="animate-in-up space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
          <Shield className="h-6 w-6 text-gold" />
        </div>
        <h2 className="text-xl font-semibold">{t("sync.heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("sync.description")}</p>
      </div>

      {syncState === "idle" && (
        <Button onClick={onSync} className="w-full">
          {t("sync.syncButton")}
        </Button>
      )}

      {syncState === "syncing" && (
        <div className="space-y-3">
          <Progress value={syncPercentage} aria-label={t("sync.syncing")}>
            <ProgressLabel>{t("sync.syncing")}</ProgressLabel>
            <ProgressValue>
              {() => (progress ? `${progress.current}/${progress.total}` : "...")}
            </ProgressValue>
          </Progress>
        </div>
      )}

      {syncState === "done" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
            <p className="font-medium">
              {t("sync.syncComplete", { count: progress?.synced ?? 0 })}
            </p>
          </div>
          <Button onClick={onComplete} disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("sync.completing")}
              </>
            ) : (
              t("sync.completeButton")
            )}
          </Button>
        </div>
      )}

      {syncState === "error" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("sync.syncError")}</p>
          <div className="flex gap-3">
            <Button onClick={onSync} variant="outline" className="flex-1">
              {t("sync.syncButton")}
            </Button>
            <Button onClick={onComplete} disabled={isPending} className="flex-1">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("sync.completing")}
                </>
              ) : (
                t("sync.completeButton")
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main wizard ────────────────────────────────────────────────────────────

export function OnboardingWizard({
  initialRegion,
  initialGameName,
  initialTagLine,
  initialPrimaryRole,
  initialSecondaryRole,
  isLinked: initialIsLinked,
}: OnboardingWizardProps) {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const { updateSession } = useAuth();
  const [isPending, startTransition] = useTransition();

  // Step state
  const [step, setStep] = useState(1);

  // Form state
  const [region, setRegion] = useState<string | null>(initialRegion);
  const [riotId, setRiotId] = useState("");
  const [isLinked, setIsLinked] = useState(initialIsLinked);
  const [linkedName, setLinkedName] = useState(
    initialGameName && initialTagLine ? `${initialGameName}#${initialTagLine}` : null,
  );
  const [primaryRole, setPrimaryRole] = useState(initialPrimaryRole || "");
  const [secondaryRole, setSecondaryRole] = useState(initialSecondaryRole || "");

  // Sync state
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const { isSyncing, progress, handleSync } = useSyncMatches(isLinked);
  const prevIsSyncingRef = useRef(isSyncing);

  // Watch for sync completion
  useEffect(() => {
    if (prevIsSyncingRef.current && !isSyncing && syncState === "syncing") {
      // Sync just finished
      setSyncState("done");
    }
    prevIsSyncingRef.current = isSyncing;
  }, [isSyncing, syncState]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    if (step === 1) {
      if (!region) return;
      // Save region before advancing — server action is fire-and-forget
      startTransition(async () => {
        const { updateRegion } = await import("@/app/actions/settings");
        await updateRegion(region);
        await updateSession();
        setStep(2);
      });
      return;
    }

    if (step === 3) {
      // Save role preferences if set
      if (primaryRole) {
        startTransition(async () => {
          const result = await updateRolePreferences(
            primaryRole as Position,
            secondaryRole === "none" ? null : (secondaryRole as Position) || null,
          );
          if (result && "error" in result) {
            toast.error(t("toasts.rolesError"));
          } else {
            toast.success(t("toasts.rolesSaved"));
          }
          await updateSession();
          setStep(4);
        });
        return;
      }
      setStep(4);
      return;
    }

    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, [step, region, primaryRole, secondaryRole, startTransition, updateSession, t]);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  const handleLinkAccount = useCallback(() => {
    if (!riotId.includes("#")) {
      toast.error(t("riotAccount.formatError"));
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("riotId", riotId);
      formData.set("region", region ?? "");
      const result = await linkRiotAccount(formData);

      if (result.error) {
        toast.error(result.error);
      } else {
        setIsLinked(true);
        const name = `${result.gameName}#${result.tagLine}`;
        setLinkedName(name);
        setRiotId("");
        toast.success(
          t("toasts.linkSuccess", { gameName: result.gameName!, tagLine: result.tagLine! }),
        );
        await updateSession();
      }
    });
  }, [riotId, region, startTransition, updateSession, t]);

  const handleStartSync = useCallback(() => {
    setSyncState("syncing");
    handleSync({ limit: 10 });
  }, [handleSync]);

  const handleComplete = useCallback(() => {
    startTransition(async () => {
      const result = await completeOnboarding();
      if (result.error) {
        toast.error(t("toasts.completeError"));
        return;
      }
      await updateSession();
      router.push("/dashboard");
    });
  }, [startTransition, updateSession, router, t]);

  // ─── Can advance? ─────────────────────────────────────────────────────

  const canAdvance = (() => {
    switch (step) {
      case 1:
        return !!region;
      case 2:
        return isLinked;
      case 3:
        return true; // Optional step
      default:
        return false;
    }
  })();

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="bg-mesh flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="surface-glow w-full max-w-lg">
        <CardContent className="space-y-6 p-6 sm:p-8">
          {/* Header */}
          <div className="space-y-1 text-center">
            <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>

          {/* Progress */}
          <StepIndicator currentStep={step} t={t} />

          {/* Steps */}
          {step === 1 && <RegionStep region={region} onRegionChange={setRegion} t={t} />}
          {step === 2 && (
            <RiotAccountStep
              riotId={riotId}
              onRiotIdChange={setRiotId}
              onLink={handleLinkAccount}
              isPending={isPending}
              linked={isLinked}
              linkedName={linkedName}
              t={t}
            />
          )}
          {step === 3 && (
            <RolesStep
              primaryRole={primaryRole}
              secondaryRole={secondaryRole}
              onPrimaryChange={setPrimaryRole}
              onSecondaryChange={setSecondaryRole}
              t={t}
            />
          )}
          {step === 4 && (
            <SyncStep
              syncState={syncState}
              progress={progress}
              onSync={handleStartSync}
              onComplete={handleComplete}
              isPending={isPending}
              t={t}
            />
          )}

          {/* Navigation */}
          {step < TOTAL_STEPS && (
            <div className="flex justify-between gap-3">
              {step > 1 ? (
                <Button variant="outline" onClick={handleBack} disabled={isPending}>
                  {t("back")}
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                {step === 3 && (
                  <Button variant="ghost" onClick={() => setStep(4)} disabled={isPending}>
                    {t("skip")}
                  </Button>
                )}
                <Button onClick={handleNext} disabled={!canAdvance || isPending}>
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t("next")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

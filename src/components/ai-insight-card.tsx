"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Sparkles, Loader2, RefreshCw, AlertCircle, X, Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import type { InsightResult, InsightError } from "@/app/actions/ai-insights";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AiInsightDrawerProps {
  /** The title to display in the drawer header */
  title: string;
  /** Pre-loaded cached insight, if any */
  cachedInsight?: InsightResult | null;
  /** Whether the AI API key is configured */
  isConfigured: boolean;
  /** Current locale for date formatting */
  locale: string;
  /** Callback to generate the insight — returns result or error */
  onGenerate: (forceRegenerate: boolean) => Promise<InsightResult | InsightError>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isError(result: InsightResult | InsightError): result is InsightError {
  return "error" in result;
}

const proseClasses = [
  "prose prose-sm prose-invert max-w-none",
  // Headings
  "[&>h2]:text-sm [&>h2]:font-semibold [&>h2]:text-gold [&>h2]:mt-5 [&>h2]:mb-2 [&>h2]:first:mt-0",
  "[&>h3]:text-sm [&>h3]:font-medium [&>h3]:text-foreground [&>h3]:mt-4 [&>h3]:mb-1.5",
  // Lists
  "[&>ul]:space-y-1.5 [&>ul]:mb-3 [&>ol]:space-y-1.5 [&>ol]:mb-3",
  "[&_li]:text-foreground/80 [&_li]:leading-relaxed",
  // Paragraphs
  "[&>p]:text-foreground/80 [&>p]:leading-relaxed [&>p]:mb-3",
  // Dividers
  "[&>hr]:border-border/50 [&>hr]:my-4",
  // Bold emphasis
  "[&_strong]:text-foreground [&_strong]:font-semibold",
].join(" ");

// ─── Trigger Button ─────────────────────────────────────────────────────────

export function AiInsightTrigger({
  isConfigured,
  hasCachedInsight,
  isPending,
  className,
}: {
  isConfigured: boolean;
  hasCachedInsight: boolean;
  isPending: boolean;
  className?: string;
}) {
  const t = useTranslations("AiInsights");

  if (!isConfigured) return null;

  return (
    <DialogPrimitive.Trigger
      render={
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-1.5 transition-all",
            hasCachedInsight && "border-gold/30 text-gold hover:border-gold/50",
            className,
          )}
          title={t("triggerTooltip")}
        />
      }
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles
          className={cn(
            "h-3.5 w-3.5",
            hasCachedInsight ? "fill-gold/20 text-gold" : "text-muted-foreground",
          )}
        />
      )}
      <span className="hidden sm:inline">
        {isPending ? t("loading") : hasCachedInsight ? t("viewInsight") : t("triggerLabel")}
      </span>
    </DialogPrimitive.Trigger>
  );
}

// ─── Drawer Component ───────────────────────────────────────────────────────

export function AiInsightDrawer({
  title,
  cachedInsight,
  isConfigured,
  locale,
  onGenerate,
}: AiInsightDrawerProps) {
  const t = useTranslations("AiInsights");
  const tPremium = useTranslations("Premium");
  const [insight, setInsight] = useState<InsightResult | null>(cachedInsight ?? null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleGenerate = useCallback(
    (forceRegenerate: boolean) => {
      setError(null);
      startTransition(async () => {
        const result = await onGenerate(forceRegenerate);
        if (isError(result)) {
          setError(result.error);
          if (result.premiumRequired) {
            setPremiumRequired(true);
            toast.error(t("toasts.premiumRequired"));
          } else if (result.limitReached) {
            setLimitReached(true);
            toast.error(t("toasts.limitReached"));
          } else {
            toast.error(t("toasts.error"));
          }
        } else {
          setInsight(result);
          if (!result.cached) {
            toast.success(t("toasts.generated"));
          }
        }
      });
    },
    [onGenerate, t],
  );

  // Auto-generate on open if no insight yet and not already loading
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen && !insight && !isPending && isConfigured && !limitReached && !premiumRequired) {
        handleGenerate(false);
      }
    },
    [insight, isPending, isConfigured, limitReached, premiumRequired, handleGenerate],
  );

  if (!isConfigured) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <AiInsightTrigger
        isConfigured={isConfigured}
        hasCachedInsight={!!insight}
        isPending={isPending && !open}
      />
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        {/* Drawer panel */}
        <DialogPrimitive.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col",
            "border-l border-border/50 bg-background shadow-2xl outline-none",
            "data-open:animate-in data-open:duration-300 data-open:slide-in-from-right",
            "data-closed:animate-out data-closed:duration-200 data-closed:slide-out-to-right",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
            <DialogPrimitive.Title className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-gold" />
              {title}
            </DialogPrimitive.Title>
            <div className="flex items-center gap-1.5">
              {insight && (
                <>
                  {insight.cached && (
                    <Badge variant="secondary" className="text-[10px]">
                      {t("cached")}
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {t("generatedAt", { date: formatDate(insight.createdAt, locale) })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleGenerate(true)}
                    disabled={isPending}
                    title={t("regenerateButton")}
                  >
                    {isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                </>
              )}
              <DialogPrimitive.Close
                render={<Button variant="ghost" size="icon-xs" aria-label="Close" />}
              >
                <X className="h-3.5 w-3.5" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Loading state */}
            {isPending && !insight && (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gold" />
                <p className="text-sm text-muted-foreground">{t("loading")}</p>
              </div>
            )}

            {/* Premium gate state */}
            {premiumRequired && !insight && !isPending && (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
                  <Crown className="h-7 w-7 text-gold" />
                </div>
                <h3 className="text-lg font-semibold">{tPremium("gateTitle")}</h3>
                <p className="text-center text-sm text-muted-foreground">
                  {tPremium("gateDescription")}
                </p>
                <p className="text-xs text-muted-foreground">{tPremium("gateContact")}</p>
              </div>
            )}

            {/* Error state (no insight) */}
            {error && !insight && !isPending && !premiumRequired && (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
                {!limitReached && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerate(false)}
                    className="gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-gold" />
                    {t("generateButton")}
                  </Button>
                )}
                {limitReached && (
                  <p className="text-xs text-muted-foreground">{t("dailyLimitReached")}</p>
                )}
              </div>
            )}

            {/* Insight content */}
            {insight && (
              <>
                <div className={proseClasses}>
                  <ReactMarkdown>{insight.content}</ReactMarkdown>
                </div>
                {error && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

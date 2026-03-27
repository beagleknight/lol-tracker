"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { InsightResult, InsightError } from "@/app/actions/ai-insights";
import { formatDate } from "@/lib/format";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AiInsightCardProps {
  /** The title to display (e.g. "AI Matchup Advice") */
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

// ─── Component ──────────────────────────────────────────────────────────────

export function AiInsightCard({
  title,
  cachedInsight,
  isConfigured,
  locale,
  onGenerate,
}: AiInsightCardProps) {
  const t = useTranslations("AiInsights");
  const [insight, setInsight] = useState<InsightResult | null>(cachedInsight ?? null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = (forceRegenerate: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await onGenerate(forceRegenerate);
      if (isError(result)) {
        setError(result.error);
        if (result.limitReached) setLimitReached(true);
        if (result.limitReached) {
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
  };

  // Not configured — show disabled state
  if (!isConfigured) {
    return (
      <Card className="border-dashed opacity-60">
        <CardContent className="flex items-center gap-3 py-4">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("noApiKey")}</p>
        </CardContent>
      </Card>
    );
  }

  // No insight yet — show generate button
  if (!insight) {
    return (
      <Card className="border-dashed border-gold/30 hover:border-gold/50 transition-colors">
        <CardContent className="flex flex-col items-center gap-3 py-6">
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => handleGenerate(false)}
            disabled={isPending || limitReached}
            className="gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("loading")}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-gold" />
                {t("generateButton")}
              </>
            )}
          </Button>
          {limitReached && (
            <p className="text-xs text-muted-foreground">{t("dailyLimitReached")}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Insight loaded — render it
  return (
    <Card className="surface-glow border-gold/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
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
              size="icon"
              className="h-6 w-6"
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
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className={[
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
        ].join(" ")}>
          <ReactMarkdown>{insight.content}</ReactMarkdown>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive mt-3">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

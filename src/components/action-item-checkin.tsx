"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { cn } from "@/lib/utils";

export type OutcomeValue = "nailed_it" | "forgot" | "unsure" | null;

export interface ActionItemOutcome {
  actionItemId: number;
  description: string;
  topicName?: string;
  outcome: OutcomeValue;
}

interface ActionItemCheckinProps {
  items: ActionItemOutcome[];
  onChange: (items: ActionItemOutcome[]) => void;
}

const OUTCOME_OPTIONS: Array<{ value: OutcomeValue & string; emoji: string; key: string }> = [
  { value: "nailed_it", emoji: "✅", key: "nailedIt" },
  { value: "forgot", emoji: "❌", key: "forgot" },
  { value: "unsure", emoji: "🤷", key: "unsure" },
];

export function ActionItemCheckin({ items, onChange }: ActionItemCheckinProps) {
  const t = useTranslations("ActionItemCheckin");

  const setOutcome = useCallback(
    (actionItemId: number, outcome: OutcomeValue) => {
      onChange(
        items.map((item) =>
          item.actionItemId === actionItemId
            ? { ...item, outcome: item.outcome === outcome ? null : outcome }
            : item,
        ),
      );
    },
    [items, onChange],
  );

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">{t("title")}</h4>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.actionItemId}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{item.description}</p>
              {item.topicName && <p className="text-xs text-muted-foreground">{item.topicName}</p>}
            </div>
            <div className="flex gap-1">
              {OUTCOME_OPTIONS.map(({ value, emoji, key }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOutcome(item.actionItemId, value)}
                  className={cn(
                    "rounded px-2 py-1 text-sm transition-colors",
                    item.outcome === value
                      ? "bg-accent text-foreground ring-1 ring-ring"
                      : "text-muted-foreground hover:bg-accent/50",
                  )}
                  aria-label={t(key, { item: item.description })}
                  aria-pressed={item.outcome === value}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

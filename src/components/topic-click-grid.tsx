"use client";

import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { cn } from "@/lib/utils";

export interface TopicToggle {
  topicId: number;
  topicName: string;
  type: "highlight" | "lowlight";
}

interface TopicClickGridProps {
  topics: Array<{ id: number; name: string }>;
  selected: TopicToggle[];
  onChange: (selected: TopicToggle[]) => void;
  maxPerType?: number;
}

export function TopicClickGrid({
  topics,
  selected,
  onChange,
  maxPerType = 3,
}: TopicClickGridProps) {
  const t = useTranslations("TopicClickGrid");

  const getState = useCallback(
    (topicId: number): "highlight" | "lowlight" | null => {
      const item = selected.find((s) => s.topicId === topicId);
      return item?.type ?? null;
    },
    [selected],
  );

  const highlightCount = selected.filter((s) => s.type === "highlight").length;
  const lowlightCount = selected.filter((s) => s.type === "lowlight").length;

  const toggle = useCallback(
    (topicId: number, topicName: string, type: "highlight" | "lowlight") => {
      const existing = selected.find((s) => s.topicId === topicId);

      if (existing?.type === type) {
        // Deselect
        onChange(selected.filter((s) => s.topicId !== topicId));
        return;
      }

      // Check max per type
      const currentCount = selected.filter((s) => s.type === type).length;
      const isSwitch = existing != null; // switching from other type
      if (!isSwitch && currentCount >= maxPerType) return;

      // Remove existing entry for this topic (if switching) and add new
      const filtered = selected.filter((s) => s.topicId !== topicId);
      onChange([...filtered, { topicId, topicName, type }]);
    },
    [selected, onChange, maxPerType],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("clickToToggle")}</span>
        <span>
          <ThumbsUp className="inline-block h-3 w-3 text-win" /> {highlightCount}/{maxPerType}
          {" · "}
          <ThumbsDown className="inline-block h-3 w-3 text-loss" /> {lowlightCount}/{maxPerType}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {topics.map((topic) => {
          const state = getState(topic.id);
          return (
            <div
              key={topic.id}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
                state === "highlight" && "border-win/40 bg-win/10",
                state === "lowlight" && "border-loss/40 bg-loss/10",
                !state && "border-border bg-card",
              )}
            >
              <span className="truncate pr-2">{topic.name}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => toggle(topic.id, topic.name, "highlight")}
                  disabled={
                    state !== "highlight" && highlightCount >= maxPerType && state !== "lowlight"
                  }
                  className={cn(
                    "rounded p-1 transition-colors",
                    state === "highlight"
                      ? "bg-win/20 text-win"
                      : "text-muted-foreground hover:bg-win/10 hover:text-win",
                    "disabled:cursor-not-allowed disabled:opacity-30",
                  )}
                  aria-label={t("markHighlight", { topic: topic.name })}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => toggle(topic.id, topic.name, "lowlight")}
                  disabled={
                    state !== "lowlight" && lowlightCount >= maxPerType && state !== "highlight"
                  }
                  className={cn(
                    "rounded p-1 transition-colors",
                    state === "lowlight"
                      ? "bg-loss/20 text-loss"
                      : "text-muted-foreground hover:bg-loss/10 hover:text-loss",
                    "disabled:cursor-not-allowed disabled:opacity-30",
                  )}
                  aria-label={t("markLowlight", { topic: topic.name })}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

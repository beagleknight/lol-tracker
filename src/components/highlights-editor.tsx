"use client";

import { Plus, X, ThumbsUp, ThumbsDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface TopicOption {
  id: number;
  name: string;
}

export interface HighlightItem {
  type: "highlight" | "lowlight";
  text?: string | null;
  topicId?: number;
  topicName?: string; // For display — resolved from topicId
}

interface HighlightsEditorProps {
  highlights: HighlightItem[];
  onChange: (highlights: HighlightItem[]) => void;
  topics: TopicOption[];
  maxPerType?: number;
}

export function HighlightsEditor({
  highlights,
  onChange,
  topics,
  maxPerType = 3,
}: HighlightsEditorProps) {
  const t = useTranslations("HighlightsEditor");
  const [newHighlightText, setNewHighlightText] = useState("");
  const [newHighlightTopicId, setNewHighlightTopicId] = useState("");
  const [newLowlightText, setNewLowlightText] = useState("");
  const [newLowlightTopicId, setNewLowlightTopicId] = useState("");

  const highlightItems = highlights.filter((h) => h.type === "highlight");
  const lowlightItems = highlights.filter((h) => h.type === "lowlight");

  const getTopicName = useCallback(
    (topicId: number | undefined) => {
      if (!topicId) return undefined;
      return topics.find((t) => t.id === topicId)?.name;
    },
    [topics],
  );

  const addItem = useCallback(
    (type: "highlight" | "lowlight") => {
      const text = type === "highlight" ? newHighlightText : newLowlightText;
      const topicIdStr = type === "highlight" ? newHighlightTopicId : newLowlightTopicId;
      if (!text.trim() && !topicIdStr) return;

      const items = type === "highlight" ? highlightItems : lowlightItems;
      if (items.length >= maxPerType) return;

      const topicId = topicIdStr ? Number(topicIdStr) : undefined;
      const topicName = getTopicName(topicId);

      onChange([...highlights, { type, text: text.trim(), topicId, topicName }]);

      if (type === "highlight") {
        setNewHighlightText("");
        setNewHighlightTopicId("");
      } else {
        setNewLowlightText("");
        setNewLowlightTopicId("");
      }
    },
    [
      highlights,
      highlightItems,
      lowlightItems,
      maxPerType,
      newHighlightText,
      newHighlightTopicId,
      newLowlightText,
      newLowlightTopicId,
      onChange,
      getTopicName,
    ],
  );

  const removeItem = useCallback(
    (index: number) => {
      onChange(highlights.filter((_, i) => i !== index));
    },
    [highlights, onChange],
  );

  return (
    <div className="space-y-4">
      {/* Highlights */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ThumbsUp className="h-3 w-3 text-win" />
          {t("highlightsLabel", { count: highlightItems.length, max: maxPerType })}
        </label>

        {/* Existing highlights */}
        {highlightItems.map((item, idx) => {
          const globalIdx = highlights.indexOf(item);
          const displayTopic = item.topicName || getTopicName(item.topicId);
          return (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-md border border-win/20 bg-win/5 px-3 py-1.5 text-sm"
            >
              {displayTopic && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {displayTopic}
                </Badge>
              )}
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => removeItem(globalIdx)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Remove highlight"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        {/* Add highlight input — topic first, then detail */}
        {highlightItems.length < maxPerType && (
          <div className="flex gap-2">
            <select
              value={newHighlightTopicId}
              onChange={(e) => setNewHighlightTopicId(e.target.value)}
              aria-label={t("highlightTopicLabel")}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground"
            >
              <option value="">{t("topicPlaceholder")}</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
            <Input
              value={newHighlightText}
              onChange={(e) => setNewHighlightText(e.target.value)}
              placeholder={t("detailsPlaceholder")}
              className="h-8 flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem("highlight");
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 px-2"
              onClick={() => addItem("highlight")}
              disabled={!newHighlightText.trim() && !newHighlightTopicId}
              aria-label="Add highlight"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Lowlights */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ThumbsDown className="h-3 w-3 text-loss" />
          {t("lowlightsLabel", { count: lowlightItems.length, max: maxPerType })}
        </label>

        {/* Existing lowlights */}
        {lowlightItems.map((item, idx) => {
          const globalIdx = highlights.indexOf(item);
          const displayTopic = item.topicName || getTopicName(item.topicId);
          return (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-md border border-loss/20 bg-loss/5 px-3 py-1.5 text-sm"
            >
              {displayTopic && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {displayTopic}
                </Badge>
              )}
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => removeItem(globalIdx)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Remove lowlight"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        {/* Add lowlight input — topic first, then detail */}
        {lowlightItems.length < maxPerType && (
          <div className="flex gap-2">
            <select
              value={newLowlightTopicId}
              onChange={(e) => setNewLowlightTopicId(e.target.value)}
              aria-label={t("lowlightTopicLabel")}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground"
            >
              <option value="">{t("topicPlaceholder")}</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
            <Input
              value={newLowlightText}
              onChange={(e) => setNewLowlightText(e.target.value)}
              placeholder={t("detailsPlaceholder")}
              className="h-8 flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem("lowlight");
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 px-2"
              onClick={() => addItem("lowlight")}
              disabled={!newLowlightText.trim() && !newLowlightTopicId}
              aria-label="Add lowlight"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Read-only display of highlights/lowlights (for coaching detail, scouting report, etc.)
 */
export function HighlightsDisplay({
  highlights,
  compact = false,
}: {
  highlights: HighlightItem[];
  compact?: boolean;
}) {
  const t = useTranslations("HighlightsEditor");
  const highlightItems = highlights.filter((h) => h.type === "highlight");
  const lowlightItems = highlights.filter((h) => h.type === "lowlight");

  if (highlights.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {highlightItems.map((item, i) => (
          <span
            key={`h-${i}`}
            className="inline-flex items-center gap-1 rounded-md bg-win/10 px-2 py-0.5 text-[11px] text-win"
          >
            <ThumbsUp className="h-2.5 w-2.5" />
            {item.topicName}
          </span>
        ))}
        {lowlightItems.map((item, i) => (
          <span
            key={`l-${i}`}
            className="inline-flex items-center gap-1 rounded-md bg-loss/10 px-2 py-0.5 text-[11px] text-loss"
          >
            <ThumbsDown className="h-2.5 w-2.5" />
            {item.topicName}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {highlightItems.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ThumbsUp className="h-3 w-3 text-win" />
            {t("highlightsHeading")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {highlightItems.map((item, i) => (
              <span
                key={`h-${i}`}
                className="inline-flex items-center gap-1 rounded-md bg-win/10 px-2 py-1 text-xs text-win"
              >
                <ThumbsUp className="h-3 w-3" />
                {item.topicName}
              </span>
            ))}
          </div>
        </div>
      )}
      {lowlightItems.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ThumbsDown className="h-3 w-3 text-loss" />
            {t("lowlightsHeading")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {lowlightItems.map((item, i) => (
              <span
                key={`l-${i}`}
                className="inline-flex items-center gap-1 rounded-md bg-loss/10 px-2 py-1 text-xs text-loss"
              >
                <ThumbsDown className="h-3 w-3" />
                {item.topicName}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

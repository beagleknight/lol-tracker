"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { PREDEFINED_TOPICS } from "@/lib/topics";
import { Plus, X, ThumbsUp, ThumbsDown } from "lucide-react";

export interface HighlightItem {
  type: "highlight" | "lowlight";
  text: string;
  topic?: string;
}

interface HighlightsEditorProps {
  highlights: HighlightItem[];
  onChange: (highlights: HighlightItem[]) => void;
  maxPerType?: number;
}

export function HighlightsEditor({
  highlights,
  onChange,
  maxPerType = 3,
}: HighlightsEditorProps) {
  const [newHighlightText, setNewHighlightText] = useState("");
  const [newHighlightTopic, setNewHighlightTopic] = useState("");
  const [newLowlightText, setNewLowlightText] = useState("");
  const [newLowlightTopic, setNewLowlightTopic] = useState("");

  const highlightItems = highlights.filter((h) => h.type === "highlight");
  const lowlightItems = highlights.filter((h) => h.type === "lowlight");

  const addItem = useCallback(
    (type: "highlight" | "lowlight") => {
      const text = type === "highlight" ? newHighlightText : newLowlightText;
      const topic = type === "highlight" ? newHighlightTopic : newLowlightTopic;
      if (!text.trim() && !topic) return;

      const items = type === "highlight" ? highlightItems : lowlightItems;
      if (items.length >= maxPerType) return;

      onChange([
        ...highlights,
        { type, text: text.trim(), topic: topic || undefined },
      ]);

      if (type === "highlight") {
        setNewHighlightText("");
        setNewHighlightTopic("");
      } else {
        setNewLowlightText("");
        setNewLowlightTopic("");
      }
    },
    [
      highlights,
      highlightItems,
      lowlightItems,
      maxPerType,
      newHighlightText,
      newHighlightTopic,
      newLowlightText,
      newLowlightTopic,
      onChange,
    ]
  );

  const removeItem = useCallback(
    (index: number) => {
      onChange(highlights.filter((_, i) => i !== index));
    },
    [highlights, onChange]
  );

  return (
    <div className="space-y-4">
      {/* Highlights */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <ThumbsUp className="h-3 w-3 text-green-400" />
          Highlights — what went well ({highlightItems.length}/{maxPerType})
        </label>

        {/* Existing highlights */}
        {highlightItems.map((item, idx) => {
          const globalIdx = highlights.indexOf(item);
          return (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-md border border-green-400/20 bg-green-400/5 px-3 py-1.5 text-sm"
            >
              {item.topic && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {item.topic}
                </Badge>
              )}
              {item.text && <span className="flex-1 text-muted-foreground">{item.text}</span>}
              {!item.text && <span className="flex-1" />}
              <button
                type="button"
                onClick={() => removeItem(globalIdx)}
                className="text-muted-foreground hover:text-foreground shrink-0"
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
              value={newHighlightTopic}
              onChange={(e) => setNewHighlightTopic(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground"
            >
              <option value="">Topic...</option>
              {PREDEFINED_TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Input
              value={newHighlightText}
              onChange={(e) => setNewHighlightText(e.target.value)}
              placeholder="Details (optional)"
              className="flex-1 text-sm h-8"
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
              className="h-8 px-2 shrink-0"
              onClick={() => addItem("highlight")}
              disabled={!newHighlightText.trim() && !newHighlightTopic}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Lowlights */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <ThumbsDown className="h-3 w-3 text-red-400" />
          Lowlights — what went wrong ({lowlightItems.length}/{maxPerType})
        </label>

        {/* Existing lowlights */}
        {lowlightItems.map((item, idx) => {
          const globalIdx = highlights.indexOf(item);
          return (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-md border border-red-400/20 bg-red-400/5 px-3 py-1.5 text-sm"
            >
              {item.topic && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {item.topic}
                </Badge>
              )}
              {item.text && <span className="flex-1 text-muted-foreground">{item.text}</span>}
              {!item.text && <span className="flex-1" />}
              <button
                type="button"
                onClick={() => removeItem(globalIdx)}
                className="text-muted-foreground hover:text-foreground shrink-0"
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
              value={newLowlightTopic}
              onChange={(e) => setNewLowlightTopic(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground"
            >
              <option value="">Topic...</option>
              {PREDEFINED_TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Input
              value={newLowlightText}
              onChange={(e) => setNewLowlightText(e.target.value)}
              placeholder="Details (optional)"
              className="flex-1 text-sm h-8"
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
              className="h-8 px-2 shrink-0"
              onClick={() => addItem("lowlight")}
              disabled={!newLowlightText.trim() && !newLowlightTopic}
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
  const highlightItems = highlights.filter((h) => h.type === "highlight");
  const lowlightItems = highlights.filter((h) => h.type === "lowlight");

  if (highlights.length === 0) return null;

  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex flex-wrap gap-1.5">
          {highlightItems.map((item, i) => {
            const hasText = !!(item.text && item.topic);
            return (
              <Tooltip key={`h-${i}`}>
                <TooltipTrigger
                  className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] cursor-default ${
                    hasText
                      ? "bg-green-400/20 text-green-300"
                      : "bg-green-400/10 text-green-400"
                  }`}
                >
                  <ThumbsUp className="h-2.5 w-2.5" />
                  {item.topic || item.text}
                </TooltipTrigger>
                {hasText && (
                  <TooltipContent side="bottom">
                    {item.text}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
          {lowlightItems.map((item, i) => {
            const hasText = !!(item.text && item.topic);
            return (
              <Tooltip key={`l-${i}`}>
                <TooltipTrigger
                  className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] cursor-default ${
                    hasText
                      ? "bg-red-400/20 text-red-300"
                      : "bg-red-400/10 text-red-400"
                  }`}
                >
                  <ThumbsDown className="h-2.5 w-2.5" />
                  {item.topic || item.text}
                </TooltipTrigger>
                {hasText && (
                  <TooltipContent side="bottom">
                    {item.text}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-3">
      {highlightItems.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <ThumbsUp className="h-3 w-3 text-green-400" />
            Highlights
          </p>
          {highlightItems.map((item, i) => {
            const hasText = !!item.text;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                  hasText
                    ? "border-green-400/30 bg-green-400/10"
                    : "border-green-400/20 bg-green-400/5"
                }`}
              >
                <span className="flex-1">{item.text || item.topic}</span>
                {item.topic && item.text && (
                  <Badge variant="secondary" className="text-[10px]">
                    {item.topic}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
      {lowlightItems.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <ThumbsDown className="h-3 w-3 text-red-400" />
            Lowlights
          </p>
          {lowlightItems.map((item, i) => {
            const hasText = !!item.text;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                  hasText
                    ? "border-red-400/30 bg-red-400/10"
                    : "border-red-400/20 bg-red-400/5"
                }`}
              >
                <span className="flex-1">{item.text || item.topic}</span>
                {item.topic && item.text && (
                  <Badge variant="secondary" className="text-[10px]">
                    {item.topic}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

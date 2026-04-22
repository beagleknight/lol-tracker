"use client";

import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef } from "react";

import { cn } from "@/lib/utils";

interface MarkdownTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

type MarkdownAction = "bold" | "italic" | "bullet" | "numbered";

export function MarkdownTextarea({
  value,
  onChange,
  placeholder,
  className,
  rows = 4,
}: MarkdownTextareaProps) {
  const t = useTranslations("MarkdownTextarea");
  const ref = useRef<HTMLTextAreaElement>(null);

  const applyAction = useCallback(
    (action: MarkdownAction) => {
      const textarea = ref.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = value.slice(start, end);
      let replacement: string;
      let cursorOffset: number;

      switch (action) {
        case "bold":
          replacement = selected ? `**${selected}**` : "**text**";
          cursorOffset = selected ? replacement.length : 2; // cursor after **
          break;
        case "italic":
          replacement = selected ? `*${selected}*` : "*text*";
          cursorOffset = selected ? replacement.length : 1;
          break;
        case "bullet": {
          const prefix = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
          replacement = selected
            ? prefix +
              selected
                .split("\n")
                .map((line) => `- ${line}`)
                .join("\n")
            : `${prefix}- `;
          cursorOffset = replacement.length;
          break;
        }
        case "numbered": {
          const prefix = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
          replacement = selected
            ? prefix +
              selected
                .split("\n")
                .map((line, i) => `${i + 1}. ${line}`)
                .join("\n")
            : `${prefix}1. `;
          cursorOffset = replacement.length;
          break;
        }
      }

      const newValue = value.slice(0, start) + replacement + value.slice(end);
      onChange(newValue);

      // Restore focus and cursor position
      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + cursorOffset;
        textarea.setSelectionRange(pos, pos);
      });
    },
    [value, onChange],
  );

  const buttons: Array<{ action: MarkdownAction; icon: typeof Bold; label: string }> = [
    { action: "bold", icon: Bold, label: t("bold") },
    { action: "italic", icon: Italic, label: t("italic") },
    { action: "bullet", icon: List, label: t("bulletList") },
    { action: "numbered", icon: ListOrdered, label: t("numberedList") },
  ];

  return (
    <div
      className={cn(
        "rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
      <div className="flex gap-0.5 border-b border-input px-2 py-1">
        {buttons.map(({ action, icon: Icon, label }) => (
          <button
            key={action}
            type="button"
            onClick={() => applyAction(action)}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={label}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground dark:bg-input/30"
      />
    </div>
  );
}

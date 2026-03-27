"use client";

import { useState, useTransition, useCallback } from "react";
import { useTranslations } from "next-intl";
import { MessageSquareText, Pencil, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  upsertMatchupNote,
  deleteMatchupNote,
  type MatchupNoteData,
} from "@/app/actions/matchup-notes";
import { formatDate } from "@/lib/format";

// ─── Inline Note Editor ─────────────────────────────────────────────────────

function InlineNoteEditor({
  note,
  title,
  championName,
  matchupChampionName,
  locale,
  onSaved,
  defaultExpanded,
}: {
  note: MatchupNoteData | null;
  title: string;
  championName: string | null;
  matchupChampionName: string;
  locale: string;
  onSaved: () => void;
  defaultExpanded?: boolean;
}) {
  const t = useTranslations("MatchupNotes");
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note?.content ?? "");
  const [isSaving, startSaveTransition] = useTransition();

  const hasContent = !!note?.content;

  const handleSave = useCallback(() => {
    startSaveTransition(async () => {
      const result = await upsertMatchupNote(
        championName,
        matchupChampionName,
        content
      );
      if (result.success) {
        toast.success(content.trim() ? t("toasts.saved") : t("toasts.deleted"));
        setIsEditing(false);
        onSaved();
      } else {
        toast.error(result.error ?? t("toasts.saveError"));
      }
    });
  }, [championName, matchupChampionName, content, t, onSaved]);

  const handleDelete = useCallback(() => {
    if (!note) return;
    startSaveTransition(async () => {
      const result = await deleteMatchupNote(note.id);
      if (result.success) {
        toast.success(t("toasts.deleted"));
        setContent("");
        setIsEditing(false);
        onSaved();
      } else {
        toast.error(t("toasts.deleteError"));
      }
    });
  }, [note, t, onSaved]);

  const handleCancel = useCallback(() => {
    setContent(note?.content ?? "");
    setIsEditing(false);
  }, [note]);

  // Editing mode — inline textarea
  if (isEditing) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("placeholder")}
          className="min-h-20 text-sm"
          autoFocus
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {t("save")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
          >
            {t("cancel")}
          </Button>
          {note && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={isSaving}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Collapsed — just a clickable row
  if (!isExpanded && hasContent) {
    return (
      <button
        className="flex items-center gap-2 w-full text-left group"
        onClick={() => setIsExpanded(true)}
      >
        <ChevronDown className="h-3 w-3 text-muted-foreground -rotate-90 transition-transform group-hover:rotate-0" />
        <span className="text-xs font-medium text-muted-foreground truncate flex-1">
          {title}
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          {formatDate(note!.updatedAt, locale)}
        </span>
      </button>
    );
  }

  // Expanded or empty — show content + edit trigger
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-2 text-left group"
          onClick={() => hasContent && setIsExpanded(false)}
        >
          {hasContent && (
            <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform" />
          )}
          <span className="text-xs font-medium text-muted-foreground">
            {title}
          </span>
        </button>
        <button
          className="text-muted-foreground/50 hover:text-foreground transition-colors"
          onClick={() => setIsEditing(true)}
          title={t("editTooltip")}
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
      {hasContent ? (
        <div
          className="text-sm text-muted-foreground whitespace-pre-wrap pl-5 cursor-pointer hover:text-foreground transition-colors"
          onClick={() => setIsEditing(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setIsEditing(true);
          }}
        >
          {note!.content}
        </div>
      ) : (
        <button
          className="text-xs text-muted-foreground/40 italic hover:text-muted-foreground transition-colors pl-5"
          onClick={() => setIsEditing(true)}
        >
          {t("addNotes")}
        </button>
      )}
    </div>
  );
}

// ─── Matchup Notes Section (for Scout page) ─────────────────────────────────

interface MatchupNotesSectionProps {
  notes: MatchupNoteData[];
  matchupChampionName: string;
  yourChampionName?: string;
  locale: string;
  onNotesChanged?: () => void;
}

export function MatchupNotesSection({
  notes,
  matchupChampionName,
  yourChampionName,
  locale,
  onNotesChanged,
}: MatchupNotesSectionProps) {
  const t = useTranslations("MatchupNotes");

  const generalNote = notes.find((n) => n.championName === null) ?? null;
  const specificNote = yourChampionName
    ? notes.find((n) => n.championName === yourChampionName) ?? null
    : null;

  const handleSaved = useCallback(() => {
    onNotesChanged?.();
  }, [onNotesChanged]);

  const hasAnyNote = yourChampionName
    ? !!specificNote?.content
    : !!generalNote?.content;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
        <MessageSquareText className="h-3.5 w-3.5 text-gold" />
        {t("sectionTitle")}
        {hasAnyNote && (
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
        )}
      </h3>

      <div className="space-y-2 rounded-lg border border-border/30 bg-surface-elevated/50 p-3">
        {yourChampionName ? (
          /* Champion-specific note only when Your Champion is set */
          <InlineNoteEditor
            note={specificNote}
            title={t("specificNoteTitle", {
              champion: yourChampionName,
              enemy: matchupChampionName,
            })}
            championName={yourChampionName}
            matchupChampionName={matchupChampionName}
            locale={locale}
            onSaved={handleSaved}
            defaultExpanded
          />
        ) : (
          /* General note only when Any Champion is selected */
          <InlineNoteEditor
            note={generalNote}
            title={t("generalNoteTitle", { enemy: matchupChampionName })}
            championName={null}
            matchupChampionName={matchupChampionName}
            locale={locale}
            onSaved={handleSaved}
            defaultExpanded
          />
        )}
      </div>
    </div>
  );
}

// ─── Read-Only Matchup Notes (for Match Detail page) ────────────────────────

interface ReadOnlyMatchupNotesProps {
  notes: MatchupNoteData[];
  matchupChampionName: string;
  yourChampionName: string;
  locale: string;
}

export function ReadOnlyMatchupNotes({
  notes,
  matchupChampionName,
  yourChampionName,
  locale,
}: ReadOnlyMatchupNotesProps) {
  const t = useTranslations("MatchupNotes");

  if (notes.length === 0) return null;

  const generalNote = notes.find((n) => n.championName === null);
  const specificNote = notes.find((n) => n.championName === yourChampionName);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
          <MessageSquareText className="h-3.5 w-3.5 text-gold" />
          {t("readOnlyTitle")}
        </h3>
        <a
          href={`/scout?enemy=${encodeURIComponent(matchupChampionName)}&your=${encodeURIComponent(yourChampionName)}`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("viewInScout")}
        </a>
      </div>

      <div className="space-y-2 rounded-lg border border-border/30 bg-surface-elevated/50 p-3">
        {specificNote && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t("specificNoteTitle", {
                champion: yourChampionName,
                enemy: matchupChampionName,
              })}
            </p>
            <p className="text-sm mt-1 whitespace-pre-wrap pl-0">
              {specificNote.content}
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              {t("savedAt", { date: formatDate(specificNote.updatedAt, locale) })}
            </p>
          </div>
        )}

        {specificNote && generalNote && (
          <div className="border-t border-border/20" />
        )}

        {generalNote && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t("generalNoteTitle", { enemy: matchupChampionName })}
            </p>
            <p className="text-sm mt-1 whitespace-pre-wrap pl-0">
              {generalNote.content}
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              {t("savedAt", { date: formatDate(generalNote.updatedAt, locale) })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

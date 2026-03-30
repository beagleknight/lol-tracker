"use client";

import { MessageSquareText, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, useCallback } from "react";
import { toast } from "sonner";

import {
  upsertMatchupNote,
  deleteMatchupNote,
  type MatchupNoteData,
} from "@/app/actions/matchup-notes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";

// ─── Trigger Button (inline in header) ──────────────────────────────────────

interface MatchupNotesTriggerProps {
  hasNote: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

export function MatchupNotesTrigger({ hasNote, isOpen, onToggle }: MatchupNotesTriggerProps) {
  const t = useTranslations("MatchupNotes");

  return (
    <button
      onClick={onToggle}
      className={`relative rounded-md p-1.5 transition-colors ${
        isOpen
          ? "bg-gold/10 text-gold"
          : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
      }`}
      title={t("sectionTitle")}
    >
      <MessageSquareText className="h-4 w-4" />
      {hasNote && !isOpen && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-gold" />
      )}
    </button>
  );
}

// ─── Editor Panel (rendered below header, outside flex) ─────────────────────

interface MatchupNotesPanelProps {
  note: MatchupNoteData | null;
  championName: string | null;
  matchupChampionName: string;
  locale: string;
  onSaved: () => void;
  onClose: () => void;
}

export function MatchupNotesPanel({
  note,
  championName,
  matchupChampionName,
  locale,
  onSaved,
  onClose,
}: MatchupNotesPanelProps) {
  const t = useTranslations("MatchupNotes");
  const [isEditing, setIsEditing] = useState(!note?.content);
  const [content, setContent] = useState(note?.content ?? "");
  const [isSaving, startSaveTransition] = useTransition();

  const handleSave = useCallback(() => {
    startSaveTransition(async () => {
      const result = await upsertMatchupNote(championName, matchupChampionName, content);
      if (result.success) {
        toast.success(content.trim() ? t("toasts.saved") : t("toasts.deleted"));
        setIsEditing(false);
        onSaved();
        if (!content.trim()) onClose();
      } else {
        toast.error(result.error ?? t("toasts.saveError"));
      }
    });
  }, [championName, matchupChampionName, content, t, onSaved, onClose]);

  const handleDelete = useCallback(() => {
    if (!note) return;
    startSaveTransition(async () => {
      const result = await deleteMatchupNote(note.id);
      if (result.success) {
        toast.success(t("toasts.deleted"));
        setContent("");
        setIsEditing(false);
        onSaved();
        onClose();
      } else {
        toast.error(t("toasts.deleteError"));
      }
    });
  }, [note, t, onSaved, onClose]);

  const handleCancel = useCallback(() => {
    setContent(note?.content ?? "");
    if (note?.content) {
      setIsEditing(false);
    } else {
      onClose();
    }
  }, [note, onClose]);

  if (isEditing) {
    return (
      <div className="space-y-2 rounded-lg border border-border/40 bg-surface-elevated p-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("placeholder")}
          className="min-h-20 text-sm"
          /* oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional UX: focus the textarea when user clicks "add note" */
          autoFocus
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {t("save")}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isSaving}>
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

  // Read mode — show content, click to edit
  return (
    <button
      type="button"
      className="w-full cursor-pointer rounded-lg border border-border/40 bg-surface-elevated p-3 text-left transition-colors hover:border-border/60"
      onClick={() => setIsEditing(true)}
    >
      <p className="text-sm whitespace-pre-wrap">{note!.content}</p>
      <p className="mt-1.5 text-[10px] text-muted-foreground/50">
        {t("savedAt", { date: formatDate(note!.updatedAt, locale) })}
      </p>
    </button>
  );
}

// ─── Helper: pick the active note from the list ─────────────────────────────

export function pickActiveNote(
  notes: MatchupNoteData[],
  yourChampionName?: string,
): { activeNote: MatchupNoteData | null; activeChampionName: string | null } {
  const generalNote = notes.find((n) => n.championName === null) ?? null;
  const specificNote = yourChampionName
    ? (notes.find((n) => n.championName === yourChampionName) ?? null)
    : null;

  return {
    activeNote: yourChampionName ? specificNote : generalNote,
    activeChampionName: yourChampionName ?? null,
  };
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
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <MessageSquareText className="h-3.5 w-3.5 text-gold" />
          {t("readOnlyTitle")}
        </h3>
        <a
          href={`/scout?enemy=${encodeURIComponent(matchupChampionName)}&your=${encodeURIComponent(yourChampionName)}`}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
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
            <p className="mt-1 text-sm whitespace-pre-wrap">{specificNote.content}</p>
            <p className="mt-1 text-[10px] text-muted-foreground/60">
              {t("savedAt", { date: formatDate(specificNote.updatedAt, locale) })}
            </p>
          </div>
        )}

        {specificNote && generalNote && <div className="border-t border-border/20" />}

        {generalNote && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t("generalNoteTitle", { enemy: matchupChampionName })}
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{generalNote.content}</p>
            <p className="mt-1 text-[10px] text-muted-foreground/60">
              {t("savedAt", { date: formatDate(generalNote.updatedAt, locale) })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Pencil, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  upsertMatchupNote,
  deleteMatchupNote,
  type MatchupNoteData,
} from "@/app/actions/matchup-notes";
import { formatDate } from "@/lib/format";

// ─── Single Note Card ───────────────────────────────────────────────────────

function NoteCard({
  note,
  title,
  championName,
  matchupChampionName,
  locale,
}: {
  note: MatchupNoteData | null;
  title: string;
  championName: string | null;
  matchupChampionName: string;
  locale: string;
}) {
  const t = useTranslations("MatchupNotes");
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note?.content ?? "");
  const [isSaving, startSaveTransition] = useTransition();

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
      } else {
        toast.error(result.error ?? t("toasts.saveError"));
      }
    });
  }, [championName, matchupChampionName, content, t]);

  const handleDelete = useCallback(() => {
    if (!note) return;
    startSaveTransition(async () => {
      const result = await deleteMatchupNote(note.id);
      if (result.success) {
        toast.success(t("toasts.deleted"));
        setContent("");
        setIsEditing(false);
      } else {
        toast.error(t("toasts.deleteError"));
      }
    });
  }, [note, t]);

  const handleCancel = useCallback(() => {
    setContent(note?.content ?? "");
    setIsEditing(false);
  }, [note]);

  if (isEditing) {
    return (
      <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 space-y-3">
        <p className="text-sm font-medium">{title}</p>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("placeholder")}
          className="min-h-24"
          autoFocus
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
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

  return (
    <div
      className="rounded-lg border border-border/50 bg-surface-elevated p-3 group cursor-pointer hover:border-border transition-colors"
      onClick={() => setIsEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setIsEditing(true);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          title={t("editTooltip")}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
      {note?.content ? (
        <>
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
            {note.content}
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-2">
            {t("savedAt", { date: formatDate(note.updatedAt, locale) })}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground/50 italic mt-1">
          {t("addNotes")}
        </p>
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
}

export function MatchupNotesSection({
  notes,
  matchupChampionName,
  yourChampionName,
  locale,
}: MatchupNotesSectionProps) {
  const t = useTranslations("MatchupNotes");

  const generalNote = notes.find((n) => n.championName === null) ?? null;
  const specificNote = yourChampionName
    ? notes.find((n) => n.championName === yourChampionName) ?? null
    : null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <StickyNote className="h-4 w-4 text-gold" />
        {t("sectionTitle")}
      </h3>

      <div className="space-y-2">
        {/* Champion-specific note (only when Your Champion is selected) */}
        {yourChampionName && (
          <NoteCard
            note={specificNote}
            title={t("specificNoteTitle", {
              champion: yourChampionName,
              enemy: matchupChampionName,
            })}
            championName={yourChampionName}
            matchupChampionName={matchupChampionName}
            locale={locale}
          />
        )}

        {/* General note (always shown) */}
        <NoteCard
          note={generalNote}
          title={t("generalNoteTitle", { enemy: matchupChampionName })}
          championName={null}
          matchupChampionName={matchupChampionName}
          locale={locale}
        />
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-gold" />
          {t("readOnlyTitle")}
        </h3>
        <a
          href={`/scout?enemy=${encodeURIComponent(matchupChampionName)}&your=${encodeURIComponent(yourChampionName)}`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("viewInScout")}
        </a>
      </div>

      <div className="space-y-2">
        {specificNote && (
          <div className="rounded-lg border border-border/50 bg-surface-elevated p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {t("specificNoteTitle", {
                champion: yourChampionName,
                enemy: matchupChampionName,
              })}
            </p>
            <p className="text-sm mt-1 whitespace-pre-wrap">
              {specificNote.content}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-2">
              {t("savedAt", { date: formatDate(specificNote.updatedAt, locale) })}
            </p>
          </div>
        )}

        {generalNote && (
          <div className="rounded-lg border border-border/50 bg-surface-elevated p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {t("generalNoteTitle", { enemy: matchupChampionName })}
            </p>
            <p className="text-sm mt-1 whitespace-pre-wrap">
              {generalNote.content}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-2">
              {t("savedAt", { date: formatDate(generalNote.updatedAt, locale) })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

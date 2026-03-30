"use client";

import { Loader2, ArrowLeft, Video, Check, Calendar, Clock, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";

import type { CoachingSession } from "@/db/schema";

import { updateCoachingSession } from "@/app/actions/coaching";
import { HighlightsDisplay, type HighlightItem } from "@/components/highlights-editor";
import { ResultBar } from "@/components/result-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, DEFAULT_LOCALE } from "@/lib/format";
import { getChampionIconUrl } from "@/lib/riot-api";
import { PREDEFINED_TOPICS } from "@/lib/topics";

interface MatchSummary {
  id: string;
  gameDate: Date;
  championName: string;
  result: string;
  matchupChampionName: string | null;
  kills: number;
  deaths: number;
  assists: number;
  vodUrl: string | null;
}

interface EditSessionClientProps {
  session: CoachingSession;
  recentMatches: MatchSummary[];
  ddragonVersion: string;
  highlightsByMatch: Record<
    string,
    Array<{ type: "highlight" | "lowlight"; text: string; topic: string | null }>
  >;
  previousCoaches: string[];
}

/** Convert a Date to the YYYY-MM-DDTHH:MM format for datetime-local input */
function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditSessionClient({
  session,
  recentMatches,
  ddragonVersion,
  highlightsByMatch,
  previousCoaches,
}: EditSessionClientProps) {
  const router = useRouter();
  const { data: authSession } = useSession();
  const locale = authSession?.user?.locale ?? DEFAULT_LOCALE;
  const t = useTranslations("EditSession");
  const tCommon = useTranslations("Common");
  const [isPending, startTransition] = useTransition();

  const isCompleted = session.status === "completed";

  // Pre-fill form state from existing session
  const [coachName, setCoachName] = useState(session.coachName);
  const [date, setDate] = useState(() => toDatetimeLocalValue(session.date));
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(session.vodMatchId ?? null);

  const initialTopics: string[] = session.topics ? JSON.parse(session.topics) : [];
  const [topics, setTopics] = useState<string[]>(initialTopics);
  const [customTopic, setCustomTopic] = useState("");
  const [showCoachSuggestions, setShowCoachSuggestions] = useState(false);

  // Completed-only fields
  const [duration, setDuration] = useState(session.durationMinutes?.toString() ?? "");
  const [notes, setNotes] = useState(session.notes ?? "");

  const filteredCoaches = useMemo(() => {
    if (!coachName.trim()) return previousCoaches;
    return previousCoaches.filter((c) => c.toLowerCase().includes(coachName.toLowerCase()));
  }, [coachName, previousCoaches]);

  function selectMatch(id: string) {
    setSelectedMatchId((prev) => (prev === id ? null : id));
  }

  function toggleTopic(topic: string) {
    setTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  }

  function addCustomTopic() {
    if (customTopic && !topics.includes(customTopic)) {
      setTopics((prev) => [...prev, customTopic]);
      setCustomTopic("");
    }
  }

  // Selected match details for preview
  const selectedMatch = selectedMatchId
    ? recentMatches.find((m) => m.id === selectedMatchId)
    : null;
  const selectedMatchHighlights: HighlightItem[] = selectedMatchId
    ? (highlightsByMatch[selectedMatchId] || []).map((h) => ({
        type: h.type,
        text: h.text,
        topic: h.topic || undefined,
      }))
    : [];

  function handleSubmit() {
    if (!coachName.trim()) {
      toast.error(t("toasts.coachNameRequired"));
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateCoachingSession(session.id, {
          coachName: coachName.trim(),
          date: new Date(date).toISOString(),
          vodMatchId: selectedMatchId,
          topics: topics.length > 0 ? topics : undefined,
          ...(isCompleted && {
            durationMinutes: duration ? parseInt(duration) : null,
            notes: notes || null,
          }),
        });

        if (result && "error" in result) {
          toast.error(result.error);
          return;
        }

        toast.success(t("toasts.sessionUpdated"));
        router.push(`/coaching/${session.id}`);
      } catch {
        toast.error(t("toasts.updateError"));
      }
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/coaching/${session.id}`}>
          <Button variant="ghost" size="icon" aria-label="Back to session">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {/* Session Details */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gold" />
            {t("sessionDetails")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="relative space-y-2">
              <Label htmlFor="coach">{t("coachNameLabel")}</Label>
              <Input
                id="coach"
                placeholder={t("coachNamePlaceholder")}
                value={coachName}
                onChange={(e) => setCoachName(e.target.value)}
                onFocus={() => setShowCoachSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowCoachSuggestions(false), 150);
                }}
                autoComplete="off"
              />
              {showCoachSuggestions && filteredCoaches.length > 0 && (
                <div className="absolute top-full z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
                  {filteredCoaches.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCoachName(name);
                        setShowCoachSuggestions(false);
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">{t("dateTimeLabel")}</Label>
              <Input
                id="date"
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VOD / Match to Review */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle>{t("vodToReview")}</CardTitle>
          <CardDescription>{t("vodToReviewDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noMatchesFound")}</p>
          ) : (
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {recentMatches.map((match) => {
                const isSelected = selectedMatchId === match.id;
                const dateStr = formatDate(match.gameDate, locale, "short-compact");
                const matchHL = highlightsByMatch[match.id];
                const hasHighlights = matchHL && matchHL.length > 0;
                return (
                  <button
                    key={match.id}
                    type="button"
                    className={`flex w-full flex-wrap items-center gap-2 rounded-lg p-2 text-left transition-colors sm:flex-nowrap sm:gap-3 ${
                      isSelected
                        ? "border border-gold/30 bg-gold/10"
                        : "border border-transparent hover:bg-accent"
                    }`}
                    onClick={() => selectMatch(match.id)}
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        isSelected ? "border-gold bg-gold text-black" : "border-muted-foreground/30"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <ResultBar result={match.result} size="sm" />
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      <Image
                        src={getChampionIconUrl(ddragonVersion, match.championName)}
                        alt={match.championName}
                        width={20}
                        height={20}
                        className="rounded"
                      />
                      {match.championName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {t("vs")}
                      {match.matchupChampionName ? (
                        <>
                          <Image
                            src={getChampionIconUrl(ddragonVersion, match.matchupChampionName)}
                            alt={match.matchupChampionName}
                            width={16}
                            height={16}
                            className="rounded"
                          />
                          {match.matchupChampionName}
                        </>
                      ) : (
                        "?"
                      )}
                    </span>
                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                      {hasHighlights && (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                          {t("notesBadge", { count: matchHL.length })}
                        </Badge>
                      )}
                      {match.vodUrl && <Video className="h-3.5 w-3.5 text-electric/70" />}
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {match.kills}/{match.deaths}/{match.assists}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{dateStr}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Preview of selected match highlights + VOD */}
          {selectedMatch && (
            <div className="space-y-3 rounded-lg border border-border/50 bg-surface-elevated p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {t("matchPreviewLabel", {
                  championName: selectedMatch.championName,
                  matchupChampionName: selectedMatch.matchupChampionName || "?",
                  result:
                    selectedMatch.result === "Victory"
                      ? tCommon("resultW")
                      : selectedMatch.result === "Remake"
                        ? tCommon("resultR")
                        : tCommon("resultL"),
                })}
              </p>

              {selectedMatch.vodUrl && (
                <div className="flex items-center gap-2">
                  <Video className="h-3.5 w-3.5 text-electric" />
                  <a
                    href={selectedMatch.vodUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-xs text-electric hover:underline"
                  >
                    {selectedMatch.vodUrl}
                  </a>
                </div>
              )}

              {selectedMatchHighlights.length > 0 ? (
                <HighlightsDisplay highlights={selectedMatchHighlights} />
              ) : (
                <p className="text-xs text-muted-foreground italic">{t("noHighlights")}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Topics */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle>{isCompleted ? t("topicsCovered") : t("focusAreas")}</CardTitle>
          <CardDescription>
            {isCompleted ? t("topicsCoveredDescription") : t("focusAreasDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_TOPICS.map((topic) => (
              <Badge
                key={topic}
                variant={topics.includes(topic) ? "default" : "secondary"}
                className="cursor-pointer"
                render={<button type="button" />}
                onClick={() => toggleTopic(topic)}
              >
                {topic}
              </Badge>
            ))}
            {topics
              .filter((t) => !(PREDEFINED_TOPICS as readonly string[]).includes(t))
              .map((topic) => (
                <Badge
                  key={topic}
                  variant="default"
                  className="cursor-pointer"
                  render={<button type="button" />}
                  onClick={() => toggleTopic(topic)}
                >
                  {topic}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={t("customTopicPlaceholder")}
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomTopic();
                }
              }}
              className="max-w-xs"
            />
            <Button variant="outline" size="sm" onClick={addCustomTopic}>
              {t("addButton")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Duration & Notes — only for completed sessions */}
      {isCompleted && (
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle>{t("sessionNotesTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="duration" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {t("durationLabel")}
              </Label>
              <Input
                id="duration"
                type="number"
                placeholder={t("durationPlaceholder")}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="max-w-32"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{t("sessionNotesLabel")}</Label>
              <Textarea
                id="notes"
                placeholder={t("sessionNotesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Link href={`/coaching/${session.id}`}>
          <Button variant="outline">{t("cancelButton")}</Button>
        </Link>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("saveChangesButton")}
        </Button>
      </div>
    </div>
  );
}

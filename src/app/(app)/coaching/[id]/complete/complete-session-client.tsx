"use client";

import {
  Loader2,
  Plus,
  X,
  ArrowLeft,
  Video,
  GraduationCap,
  Clock,
  CheckCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { CoachingSession } from "@/db/schema";

import { completeCoachingSession } from "@/app/actions/coaching";
import { HighlightsDisplay, type HighlightItem } from "@/components/highlights-editor";
import { ResultBadge } from "@/components/result-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-client";
import { formatDate, DEFAULT_LOCALE } from "@/lib/format";
import { getChampionIconUrl } from "@/lib/riot-api";
import { PREDEFINED_TOPICS } from "@/lib/topics";
import { safeExternalUrl } from "@/lib/url";

interface VodMatch {
  id: string;
  gameDate: Date;
  result: string;
  championName: string;
  matchupChampionName: string | null;
  kills: number;
  deaths: number;
  assists: number;
  gameDurationSeconds: number;
  vodUrl: string | null;
}

interface CompleteSessionClientProps {
  session: CoachingSession;
  vodMatch: VodMatch | null;
  vodHighlights: Array<{
    type: "highlight" | "lowlight";
    text: string;
    topic: string | null;
  }>;
  ddragonVersion: string;
}

export function CompleteSessionClient({
  session,
  vodMatch,
  vodHighlights,
  ddragonVersion,
}: CompleteSessionClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const locale = user?.locale ?? DEFAULT_LOCALE;
  const t = useTranslations("CompleteSession");
  const [isPending, startTransition] = useTransition();

  // Pre-fill topics from focus areas if they were set during scheduling
  const initialTopics: string[] = session.topics ? JSON.parse(session.topics) : [];

  const [selectedTopics, setSelectedTopics] = useState<string[]>(initialTopics);
  const [customTopic, setCustomTopic] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [actionItems, setActionItems] = useState<Array<{ description: string; topic: string }>>([]);
  const [newActionDesc, setNewActionDesc] = useState("");
  const [newActionTopic, setNewActionTopic] = useState("");

  const dateStr = formatDate(session.date, locale, "datetime");

  const highlights: HighlightItem[] = vodHighlights.map((h) => ({
    type: h.type,
    text: h.text,
    topic: h.topic || undefined,
  }));

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  }

  function addCustomTopic() {
    if (customTopic && !selectedTopics.includes(customTopic)) {
      setSelectedTopics((prev) => [...prev, customTopic]);
      setCustomTopic("");
    }
  }

  function addActionItem() {
    if (!newActionDesc.trim()) return;
    setActionItems((prev) => [
      ...prev,
      { description: newActionDesc.trim(), topic: newActionTopic },
    ]);
    setNewActionDesc("");
    setNewActionTopic("");
  }

  function removeActionItem(index: number) {
    setActionItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    if (selectedTopics.length === 0) {
      toast.error(t("toasts.topicRequired"));
      return;
    }

    startTransition(async () => {
      try {
        const result = await completeCoachingSession(session.id, {
          durationMinutes: duration ? parseInt(duration) : undefined,
          topics: selectedTopics,
          notes: notes || undefined,
          actionItems,
        });

        if (result && "error" in result) {
          toast.error(result.error);
          return;
        }

        toast.success(t("toasts.sessionCompleted"));
        router.push(`/coaching/${session.id}`);
      } catch (error) {
        // After completing the session, revalidatePath re-renders this page's
        // server component which calls redirect() (status is now "completed").
        // Next.js throws a NEXT_REDIRECT error — let it propagate so the
        // redirect actually happens instead of showing a false error toast.
        if (isRedirectError(error)) throw error;
        toast.error(t("toasts.completeError"));
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

      {/* Session Context */}
      <Card className="border-gold/20 bg-gold/5">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 shrink-0 text-gold" />
            <div className="flex-1">
              <p className="font-medium">{session.coachName}</p>
              <p className="text-sm text-muted-foreground">{dateStr}</p>
            </div>
            {vodMatch && (
              <div className="flex items-center gap-2">
                <Image
                  src={getChampionIconUrl(ddragonVersion, vodMatch.championName)}
                  alt={vodMatch.championName}
                  width={24}
                  height={24}
                  unoptimized
                  className="rounded"
                />
                <span className="text-sm">{vodMatch.championName}</span>
                <span className="text-xs text-muted-foreground">
                  {t("vs")} {vodMatch.matchupChampionName || "?"}
                </span>
                <ResultBadge result={vodMatch.result} />
              </div>
            )}
          </div>

          {/* VOD link + highlights preview */}
          {vodMatch && (
            <div className="mt-3 space-y-2">
              {vodMatch.vodUrl && (
                <div className="flex items-center gap-2">
                  <Video className="h-3.5 w-3.5 text-electric" />
                  <a
                    href={safeExternalUrl(vodMatch.vodUrl) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-xs text-electric hover:underline"
                  >
                    {t("watchVod")}
                  </a>
                </div>
              )}
              {highlights.length > 0 && <HighlightsDisplay highlights={highlights} compact />}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Topics Covered */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle>{t("topicsCovered")}</CardTitle>
          <CardDescription>{t("topicsCoveredDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_TOPICS.map((topic) => (
              <Badge
                key={topic}
                variant={selectedTopics.includes(topic) ? "default" : "secondary"}
                className="cursor-pointer"
                render={<button type="button" />}
                onClick={() => toggleTopic(topic)}
              >
                {topic}
              </Badge>
            ))}
            {selectedTopics
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

      {/* Session Notes & Duration */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle>{t("sessionDetails")}</CardTitle>
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

      {/* Action Items */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle>{t("actionItems")}</CardTitle>
          <CardDescription>{t("actionItemsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {actionItems.length > 0 && (
            <div className="space-y-2">
              {actionItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-border/50 bg-surface-elevated p-2"
                >
                  <CheckCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm">{item.description}</p>
                    {item.topic && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {item.topic}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeActionItem(i)}
                    aria-label="Remove action item"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder={t("actionItemPlaceholder")}
              value={newActionDesc}
              onChange={(e) => setNewActionDesc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addActionItem();
                }
              }}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Input
                placeholder={t("topicPlaceholder")}
                value={newActionTopic}
                onChange={(e) => setNewActionTopic(e.target.value)}
                className="flex-1 sm:w-40"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={addActionItem}
                className="shrink-0"
                aria-label="Add action item"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Link href={`/coaching/${session.id}`}>
          <Button variant="outline">{t("cancelButton")}</Button>
        </Link>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("completeSessionButton")}
        </Button>
      </div>
    </div>
  );
}

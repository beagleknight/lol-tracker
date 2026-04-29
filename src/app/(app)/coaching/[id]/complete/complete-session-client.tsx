"use client";

import { Loader2, Plus, X, Video, GraduationCap, Clock, CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { TopicOption } from "@/components/highlights-editor";
import type { CoachingSession } from "@/db/schema";

import { completeCoachingSession } from "@/app/actions/coaching";
import { BackButton } from "@/components/back-button";
import { HighlightsDisplay, type HighlightItem } from "@/components/highlights-editor";
import { ChampionIcon } from "@/components/icons/champion-icon";
import { ResultBadge } from "@/components/result-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-client";
import { formatDate, DEFAULT_LOCALE } from "@/lib/format";
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
    text: string | null;
    topicId: number | null;
    topicName: string | null;
  }>;
  ddragonVersion: string;
  topics: TopicOption[];
  initialTopicIds: number[];
}

export function CompleteSessionClient({
  session,
  vodMatch,
  vodHighlights,
  ddragonVersion: _ddragonVersion,
  topics: availableTopics,
  initialTopicIds,
}: CompleteSessionClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const locale = user?.locale ?? DEFAULT_LOCALE;
  const t = useTranslations("CompleteSession");
  const [isPending, startTransition] = useTransition();

  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>(initialTopicIds);

  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [actionItems, setActionItems] = useState<Array<{ description: string; topicId?: number }>>(
    [],
  );
  const [newActionDesc, setNewActionDesc] = useState("");
  const [newActionTopicId, setNewActionTopicId] = useState<number | undefined>(undefined);

  const dateStr = formatDate(session.date, locale, "datetime");

  const highlights: HighlightItem[] = vodHighlights.map((h) => ({
    type: h.type,
    text: h.text,
    topicId: h.topicId ?? undefined,
    topicName: h.topicName ?? undefined,
  }));

  function toggleTopic(id: number) {
    setSelectedTopicIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  function addActionItem() {
    if (!newActionDesc.trim()) return;
    setActionItems((prev) => [
      ...prev,
      { description: newActionDesc.trim(), topicId: newActionTopicId },
    ]);
    setNewActionDesc("");
    setNewActionTopicId(undefined);
  }

  function removeActionItem(index: number) {
    setActionItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    if (selectedTopicIds.length === 0) {
      toast.error(t("toasts.topicRequired"));
      return;
    }

    startTransition(async () => {
      try {
        const result = await completeCoachingSession(session.id, {
          durationMinutes: duration ? parseInt(duration) : undefined,
          topicIds: selectedTopicIds,
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
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-teal">{t("title")}</h1>
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
                <ChampionIcon championName={vodMatch.championName} size={24} />
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
            {availableTopics.map((topic) => (
              <Badge
                key={topic.id}
                variant={selectedTopicIds.includes(topic.id) ? "default" : "secondary"}
                className="cursor-pointer"
                render={<button type="button" />}
                onClick={() => toggleTopic(topic.id)}
              >
                {topic.name}
              </Badge>
            ))}
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
                    {item.topicId && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {availableTopics.find((t) => t.id === item.topicId)?.name ?? ""}
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
              <select
                value={newActionTopicId ?? ""}
                onChange={(e) =>
                  setNewActionTopicId(e.target.value ? parseInt(e.target.value) : undefined)
                }
                className="flex-1 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm sm:w-40"
              >
                <option value="">{t("topicPlaceholder")}</option>
                {availableTopics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
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

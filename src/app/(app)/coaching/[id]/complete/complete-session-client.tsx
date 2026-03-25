"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { completeCoachingSession } from "@/app/actions/coaching";
import { formatDate, DEFAULT_LOCALE } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { getChampionIconUrl } from "@/lib/riot-api";
import { PREDEFINED_TOPICS } from "@/lib/topics";
import {
  HighlightsDisplay,
  type HighlightItem,
} from "@/components/highlights-editor";
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
import Link from "next/link";
import Image from "next/image";
import type { CoachingSession } from "@/db/schema";

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
  const { data: authSession } = useSession();
  const locale = authSession?.user?.locale ?? DEFAULT_LOCALE;
  const [isPending, startTransition] = useTransition();

  // Pre-fill topics from focus areas if they were set during scheduling
  const initialTopics: string[] = session.topics
    ? JSON.parse(session.topics)
    : [];

  const [selectedTopics, setSelectedTopics] = useState<string[]>(initialTopics);
  const [customTopic, setCustomTopic] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [actionItems, setActionItems] = useState<
    Array<{ description: string; topic: string }>
  >([]);
  const [newActionDesc, setNewActionDesc] = useState("");
  const [newActionTopic, setNewActionTopic] = useState("");

  const dateStr = formatDate(session.date, locale, "long");

  const highlights: HighlightItem[] = vodHighlights.map((h) => ({
    type: h.type,
    text: h.text,
    topic: h.topic || undefined,
  }));

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
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
      toast.error("Please select at least one topic covered.");
      return;
    }

    startTransition(async () => {
      try {
        await completeCoachingSession(session.id, {
          durationMinutes: duration ? parseInt(duration) : undefined,
          topics: selectedTopics,
          notes: notes || undefined,
          actionItems,
        });

        toast.success("Coaching session completed!");
        router.push(`/coaching/${session.id}`);
      } catch {
        toast.error("Failed to complete session.");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/coaching/${session.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">
            Complete Coaching Session
          </h1>
          <p className="text-muted-foreground">
            Fill in what was discussed and create action items.
          </p>
        </div>
      </div>

      {/* Session Context */}
      <Card className="border-gold/20 bg-gold/5">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-gold shrink-0" />
            <div className="flex-1">
              <p className="font-medium">{session.coachName}</p>
              <p className="text-sm text-muted-foreground">{dateStr}</p>
            </div>
            {vodMatch && (
              <div className="flex items-center gap-2">
                <Image
                  src={getChampionIconUrl(
                    ddragonVersion,
                    vodMatch.championName
                  )}
                  alt={vodMatch.championName}
                  width={24}
                  height={24}
                  className="rounded"
                />
                <span className="text-sm">{vodMatch.championName}</span>
                <span className="text-xs text-muted-foreground">
                  vs {vodMatch.matchupChampionName || "?"}
                </span>
                <Badge
                  variant={
                    vodMatch.result === "Victory" ? "default" : "destructive"
                  }
                  className="text-xs"
                >
                  {vodMatch.result === "Victory" ? "W" : "L"}
                </Badge>
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
                    href={vodMatch.vodUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-electric hover:underline truncate"
                  >
                    Watch VOD
                  </a>
                </div>
              )}
              {highlights.length > 0 && (
                <HighlightsDisplay highlights={highlights} compact />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Topics Covered */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle>Topics Covered</CardTitle>
          <CardDescription>
            Select all topics that were actually covered during the session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_TOPICS.map((topic) => (
              <Badge
                key={topic}
                variant={
                  selectedTopics.includes(topic) ? "default" : "secondary"
                }
                className="cursor-pointer"
                onClick={() => toggleTopic(topic)}
              >
                {topic}
              </Badge>
            ))}
            {selectedTopics
              .filter(
                (t) =>
                  !(PREDEFINED_TOPICS as readonly string[]).includes(t)
              )
              .map((topic) => (
                <Badge
                  key={topic}
                  variant="default"
                  className="cursor-pointer"
                  onClick={() => toggleTopic(topic)}
                >
                  {topic}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Custom topic..."
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
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session Notes & Duration */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="duration" className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Duration (minutes)
            </Label>
            <Input
              id="duration"
              type="number"
              placeholder="60"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="max-w-32"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Session Notes</Label>
            <Textarea
              id="notes"
              placeholder="Key takeaways, what the coach said, areas to focus on..."
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
          <CardTitle>Action Items</CardTitle>
          <CardDescription>
            What should you work on before the next coaching session?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {actionItems.length > 0 && (
            <div className="space-y-2">
              {actionItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-border/50 p-2 bg-surface-elevated"
                >
                  <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm">{item.description}</p>
                    {item.topic && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        {item.topic}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeActionItem(i)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Action item description..."
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
                placeholder="Topic (optional)"
                value={newActionTopic}
                onChange={(e) => setNewActionTopic(e.target.value)}
                className="flex-1 sm:w-40"
              />
              <Button variant="outline" size="icon" onClick={addActionItem} className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Link href={`/coaching/${session.id}`}>
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Complete Session
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCoachingSession } from "@/app/actions/coaching";
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
import { HighlightsDisplay, type HighlightItem } from "@/components/highlights-editor";
import { Loader2, Plus, X, ArrowLeft, Video, Check } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

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

interface NewSessionClientProps {
  recentMatches: MatchSummary[];
  ddragonVersion: string;
  highlightsByMatch: Record<
    string,
    Array<{ type: "highlight" | "lowlight"; text: string; topic: string | null }>
  >;
}

export function NewSessionClient({
  recentMatches,
  ddragonVersion,
  highlightsByMatch,
}: NewSessionClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [coachName, setCoachName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [actionItems, setActionItems] = useState<
    Array<{ description: string; topic: string }>
  >([]);
  const [newActionDesc, setNewActionDesc] = useState("");
  const [newActionTopic, setNewActionTopic] = useState("");

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

  function selectMatch(id: string) {
    setSelectedMatchId((prev) => (prev === id ? null : id));
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

  // Get selected match details for preview
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
      toast.error("Please enter a coach name.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createCoachingSession({
          coachName: coachName.trim(),
          date: new Date(date).toISOString(),
          durationMinutes: duration ? parseInt(duration) : undefined,
          topics: selectedTopics,
          notes: notes || undefined,
          matchIds: selectedMatchId ? [selectedMatchId] : [],
          actionItems,
        });

        toast.success("Coaching session created.");
        router.push(`/coaching/${result.sessionId}`);
      } catch {
        toast.error("Failed to create session.");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/coaching">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">
            New Coaching Session
          </h1>
          <p className="text-muted-foreground">
            Log a coaching session and create action items.
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="coach">Coach Name</Label>
              <Input
                id="coach"
                placeholder="e.g. midlaneacademy"
                value={coachName}
                onChange={(e) => setCoachName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                placeholder="60"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Session Notes</Label>
            <Textarea
              id="notes"
              placeholder="Key points discussed, areas to focus on..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Topics */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle>Topics Covered</CardTitle>
          <CardDescription>
            Select topics that were covered during this session.
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
              .filter((t) => !(PREDEFINED_TOPICS as readonly string[]).includes(t))
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

      {/* Link Game — Single match picker */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle>Game Reviewed</CardTitle>
          <CardDescription>
            Select the game that was reviewed during this coaching session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No matches synced yet. Sync your games first.
            </p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {recentMatches.map((match) => {
                const isSelected = selectedMatchId === match.id;
                const dateStr = new Intl.DateTimeFormat("en-GB", {
                  day: "2-digit",
                  month: "short",
                }).format(match.gameDate);
                const matchHL = highlightsByMatch[match.id];
                const hasHighlights = matchHL && matchHL.length > 0;
                return (
                  <button
                    key={match.id}
                    type="button"
                    className={`flex items-center gap-3 rounded-lg p-2 w-full text-left transition-colors ${
                      isSelected
                        ? "bg-gold/10 border border-gold/30"
                        : "hover:bg-accent border border-transparent"
                    }`}
                    onClick={() => selectMatch(match.id)}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "border-gold bg-gold text-black"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div
                      className={`w-1 h-6 rounded-full ${
                        match.result === "Victory"
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    />
                    <span className="text-sm font-medium inline-flex items-center gap-1.5">
                      <Image
                        src={getChampionIconUrl(ddragonVersion, match.championName)}
                        alt={match.championName}
                        width={20}
                        height={20}
                        className="rounded"
                      />
                      {match.championName}
                    </span>
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      vs
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
                      ) : "?"}
                    </span>
                    <div className="flex items-center gap-1.5 ml-auto shrink-0">
                      {hasHighlights && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {matchHL.length} note{matchHL.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {match.vodUrl && (
                        <Video className="h-3.5 w-3.5 text-electric/70" />
                      )}
                    </div>
                    <span className="text-xs font-mono text-muted-foreground shrink-0">
                      {match.kills}/{match.deaths}/{match.assists}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {dateStr}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Preview of selected match highlights + VOD */}
          {selectedMatch && (
            <div className="rounded-lg border border-border/50 bg-surface-elevated p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Coaching prep for {selectedMatch.championName} vs{" "}
                {selectedMatch.matchupChampionName || "?"} —{" "}
                {selectedMatch.result === "Victory" ? "Win" : "Loss"}
              </p>

              {/* VOD link */}
              {selectedMatch.vodUrl && (
                <div className="flex items-center gap-2">
                  <Video className="h-3.5 w-3.5 text-electric" />
                  <a
                    href={selectedMatch.vodUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-electric hover:underline truncate"
                  >
                    {selectedMatch.vodUrl}
                  </a>
                </div>
              )}

              {/* Highlights / Lowlights */}
              {selectedMatchHighlights.length > 0 ? (
                <HighlightsDisplay highlights={selectedMatchHighlights} />
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No highlights/lowlights recorded for this game.
                </p>
              )}
            </div>
          )}

          {selectedMatchId && (
            <p className="text-xs text-muted-foreground">
              1 game selected
            </p>
          )}
        </CardContent>
      </Card>

      {/* Action Items */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle>Action Items</CardTitle>
          <CardDescription>
            Things to work on before the next session.
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
          <div className="flex gap-2">
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
            <Input
              placeholder="Topic (optional)"
              value={newActionTopic}
              onChange={(e) => setNewActionTopic(e.target.value)}
              className="w-40"
            />
            <Button variant="outline" size="icon" onClick={addActionItem}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Link href="/coaching">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Session
        </Button>
      </div>
    </div>
  );
}

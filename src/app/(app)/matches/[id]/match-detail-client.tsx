"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  updateMatchComment,
  updateMatchReview,
  saveMatchHighlights,
  updateMatchVodUrl,
} from "@/app/actions/matches";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  HighlightsEditor,
  type HighlightItem,
} from "@/components/highlights-editor";
import { SKIP_REVIEW_REASONS } from "@/lib/topics";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  GraduationCap,
  Save,
  SkipForward,
  Link as LinkIcon,
} from "lucide-react";
import type { Match } from "@/db/schema";
import type { RiotMatchParticipant } from "@/lib/riot-api";
import { getKeystoneIconUrlByName, getChampionIconUrl } from "@/lib/riot-api";

/** Slim participant — only fields needed for the match detail view */
type SlimParticipant = Pick<
  RiotMatchParticipant,
  | "puuid"
  | "teamId"
  | "championName"
  | "riotIdGameName"
  | "summonerName"
  | "kills"
  | "deaths"
  | "assists"
  | "totalMinionsKilled"
  | "neutralMinionsKilled"
  | "visionScore"
  | "goldEarned"
  | "totalDamageDealtToChampions"
  | "item0"
  | "item1"
  | "item2"
  | "item3"
  | "item4"
  | "item5"
  | "item6"
>;

interface MatchDetailClientProps {
  match: Match;
  participants: SlimParticipant[] | null;
  linkedSessions: Array<{
    sessionId: number;
    coachName: string;
    date: Date;
  }>;
  highlights: HighlightItem[];
  ddragonVersion: string;
  userPuuid: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function ParticipantRow({
  participant,
  version,
  isUser,
  isDuoPartner,
}: {
  participant: SlimParticipant;
  version: string;
  isUser: boolean;
  isDuoPartner: boolean;
}) {
  const cs = participant.totalMinionsKilled + participant.neutralMinionsKilled;
  const kda =
    participant.deaths === 0
      ? "Perfect"
      : ((participant.kills + participant.assists) / participant.deaths).toFixed(
          1
        );

  return (
    <TableRow
      className={
        isUser
          ? "bg-gold/5 border-l-2 border-gold/40"
          : isDuoPartner
            ? "bg-electric/5 border-l-2 border-electric/40"
            : ""
      }
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <Image
            src={getChampionIconUrl(version, participant.championName)}
            alt={participant.championName}
            width={28}
            height={28}
            className="rounded"
          />
          <div>
            <span
              className={`text-sm ${isUser ? "font-bold text-gold" : isDuoPartner ? "font-semibold text-electric" : ""}`}
            >
              {participant.riotIdGameName || participant.summonerName}
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              {participant.championName}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center font-mono text-sm">
        {participant.kills}/{participant.deaths}/{participant.assists}
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">
        {kda}
      </TableCell>
      <TableCell className="text-center text-sm">{cs}</TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">
        {participant.visionScore}
      </TableCell>
      <TableCell className="text-center text-sm">
        {(participant.goldEarned / 1000).toFixed(1)}k
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">
        {(participant.totalDamageDealtToChampions / 1000).toFixed(1)}k
      </TableCell>
      <TableCell>
        <div className="flex gap-0.5">
          {[
            participant.item0,
            participant.item1,
            participant.item2,
            participant.item3,
            participant.item4,
            participant.item5,
            participant.item6,
          ]
            .filter((id) => id > 0)
            .map((itemId, i) => (
              <Image
                key={i}
                src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`}
                alt={`Item ${itemId}`}
                width={24}
                height={24}
                className="rounded"
              />
            ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function MatchDetailClient({
  match,
  participants,
  linkedSessions,
  highlights: initialHighlights,
  ddragonVersion,
  userPuuid,
}: MatchDetailClientProps) {
  const [highlights, setHighlights] = useState<HighlightItem[]>(initialHighlights);
  const [comment, setComment] = useState(match.comment || "");
  const [vodUrl, setVodUrl] = useState(match.vodUrl || "");
  const [reviewed, setReviewed] = useState(match.reviewed);
  const [reviewNotes, setReviewNotes] = useState(match.reviewNotes || "");
  const [isSavingHighlights, startSaveHighlights] = useTransition();
  const [isSavingComment, startSaveComment] = useTransition();
  const [isSavingVodUrl, startSaveVodUrl] = useTransition();
  const [isSavingReview, startSaveReview] = useTransition();
  const [showSkipMenu, setShowSkipMenu] = useState(false);

  function saveHighlightsHandler() {
    startSaveHighlights(async () => {
      try {
        const result = await saveMatchHighlights(match.id, highlights);
        if (result.success) toast.success("Highlights saved.");
        else toast.error("Failed to save highlights.");
      } catch {
        toast.error("Failed to save highlights.");
      }
    });
  }

  function saveComment() {
    startSaveComment(async () => {
      try {
        const result = await updateMatchComment(match.id, comment);
        if (result.success) toast.success("Comment saved.");
        else toast.error("Failed to save comment.");
      } catch {
        toast.error("Failed to save comment.");
      }
    });
  }

  function saveVodUrlHandler() {
    startSaveVodUrl(async () => {
      try {
        const result = await updateMatchVodUrl(match.id, vodUrl);
        if (result.success) toast.success("VOD link saved.");
        else toast.error("Failed to save VOD link.");
      } catch {
        toast.error("Failed to save VOD link.");
      }
    });
  }

  function saveReview() {
    startSaveReview(async () => {
      try {
        const result = await updateMatchReview(match.id, reviewed, reviewNotes);
        if (result.success) toast.success("Review saved.");
        else toast.error("Failed to save review.");
      } catch {
        toast.error("Failed to save review.");
      }
    });
  }

  const handleSkipReview = useCallback(
    (reason: string) => {
      setShowSkipMenu(false);
      startSaveReview(async () => {
        try {
          const result = await updateMatchReview(match.id, true, undefined, reason);
          if (result.success) {
            setReviewed(true);
            toast.success("Marked as reviewed (skipped).");
          } else {
            toast.error("Failed to save.");
          }
        } catch {
          toast.error("Failed to save.");
        }
      });
    },
    [match.id]
  );

  // Split participants into teams
  const blueTeam = participants?.filter((p) => p.teamId === 100) || [];
  const redTeam = participants?.filter((p) => p.teamId === 200) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/matches">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Image
              src={getChampionIconUrl(ddragonVersion, match.championName)}
              alt={match.championName}
              width={48}
              height={48}
              className="rounded"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gradient-gold">{match.championName}</h1>
                <Badge
                  variant={
                    match.result === "Victory" ? "default" : "destructive"
                  }
                >
                  {match.result}
                </Badge>
                {match.reviewed && (
                  <Badge variant="secondary">Reviewed</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                {formatDate(match.gameDate)} &middot;{" "}
                {formatDuration(match.gameDurationSeconds)}
                {match.runeKeystoneName && (
                  <>
                    {" "}&middot;{" "}
                    {(() => {
                      const url = getKeystoneIconUrlByName(match.runeKeystoneName);
                      return url ? (
                        <Image src={url} alt={match.runeKeystoneName} width={16} height={16} className="inline rounded" />
                      ) : null;
                    })()}
                    {" "}{match.runeKeystoneName}
                  </>
                )}
                {match.matchupChampionName && (
                  <>
                    {" "}vs{" "}
                    <Image
                      src={getChampionIconUrl(ddragonVersion, match.matchupChampionName)}
                      alt={match.matchupChampionName}
                      width={16}
                      height={16}
                      className="inline rounded"
                    />
                    {" "}{match.matchupChampionName}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Coaching Badge */}
      {linkedSessions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {linkedSessions.map((s) => (
            <Link key={s.sessionId} href={`/coaching/${s.sessionId}`}>
              <Badge variant="secondary" className="gap-1">
                <GraduationCap className="h-3 w-3" />
                Reviewed with {s.coachName}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        <Card className="hover-lift surface-glow">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold font-mono text-gold">
              {match.kills}/{match.deaths}/{match.assists}
            </p>
            <p className="text-xs text-muted-foreground">KDA</p>
          </CardContent>
        </Card>
        <Card className="hover-lift surface-glow">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-gold">{match.cs}</p>
            <p className="text-xs text-muted-foreground">
              CS ({match.csPerMin}/min)
            </p>
          </CardContent>
        </Card>
        <Card className="hover-lift surface-glow">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-gold">
              {((match.goldEarned || 0) / 1000).toFixed(1)}k
            </p>
            <p className="text-xs text-muted-foreground">Gold</p>
          </CardContent>
        </Card>
        <Card className="hover-lift surface-glow">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-gold">{match.visionScore}</p>
            <p className="text-xs text-muted-foreground">Vision</p>
          </CardContent>
        </Card>
        <Card className="hover-lift surface-glow">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">
              {formatDuration(match.gameDurationSeconds)}
            </p>
            <p className="text-xs text-muted-foreground">Duration</p>
          </CardContent>
        </Card>
        <Card className="hover-lift surface-glow">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold flex items-center gap-2">
              {match.runeKeystoneName ? (
                <>
                  {(() => {
                    const url = getKeystoneIconUrlByName(match.runeKeystoneName);
                    return url ? (
                      <Image src={url} alt={match.runeKeystoneName} width={28} height={28} className="rounded" />
                    ) : null;
                  })()}
                  {match.runeKeystoneName}
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">Keystone</p>
          </CardContent>
        </Card>
      </div>

      {/* All 10 Players */}
      {participants && (
        <div className="space-y-4">
          {[
            { team: blueTeam, label: "Blue Team", color: "text-electric" },
            { team: redTeam, label: "Red Team", color: "text-destructive" },
          ].map(({ team, label, color }) => (
            <Card key={label} className="surface-glow">
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm ${color}`}>{label}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-center">KDA</TableHead>
                      <TableHead className="text-center">Ratio</TableHead>
                      <TableHead className="text-center">CS</TableHead>
                      <TableHead className="text-center">Vision</TableHead>
                      <TableHead className="text-center">Gold</TableHead>
                      <TableHead className="text-center">Damage</TableHead>
                      <TableHead>Items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.map((p) => (
                      <ParticipantRow
                        key={p.puuid}
                        participant={p}
                        version={ddragonVersion}
                        isUser={p.puuid === userPuuid}
                        isDuoPartner={!!match.duoPartnerPuuid && p.puuid === match.duoPartnerPuuid}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Separator />

      {/* Highlights / Lowlights */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle>Highlights & Lowlights</CardTitle>
          <CardDescription>
            Quick structured notes about what went well and what didn&apos;t.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <HighlightsEditor
            highlights={highlights}
            onChange={setHighlights}
          />
          <Button size="sm" onClick={saveHighlightsHandler} disabled={isSavingHighlights}>
            {isSavingHighlights ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-2 h-3 w-3" />
            )}
            Save Highlights
          </Button>
        </CardContent>
      </Card>

      {/* Comment + VOD + Review Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Game Notes */}
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle>Game Notes</CardTitle>
            <CardDescription>
              What happened? What was your thought process?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Got early kill but threw lead by overextending..."
              rows={4}
            />
            <Button size="sm" onClick={saveComment} disabled={isSavingComment}>
              {isSavingComment ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Save className="mr-2 h-3 w-3" />
              )}
              Save Notes
            </Button>
          </CardContent>
        </Card>

        {/* VOD Link + Review */}
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle>VOD Review</CardTitle>
            <CardDescription>
              Link to Ascent VOD and review notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* VOD URL */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <LinkIcon className="h-3 w-3" />
                Ascent VOD Link
              </label>
              <div className="flex gap-2">
                <Input
                  value={vodUrl}
                  onChange={(e) => setVodUrl(e.target.value)}
                  placeholder="https://ascent.gg/vod/..."
                  className="text-sm h-8 flex-1"
                />
                <Button size="sm" variant="outline" onClick={saveVodUrlHandler} disabled={isSavingVodUrl} className="h-8">
                  {isSavingVodUrl ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                </Button>
              </div>
              {match.vodUrl && (
                <a
                  href={match.vodUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-electric hover:underline"
                >
                  Open VOD
                </a>
              )}
            </div>

            <Separator />

            {/* Review status */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="reviewed-detail"
                checked={reviewed}
                onCheckedChange={(v) => setReviewed(!!v)}
              />
              <label htmlFor="reviewed-detail" className="text-sm">
                Mark as reviewed
              </label>
            </div>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Key takeaways from reviewing this game..."
              rows={3}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveReview} disabled={isSavingReview}>
                {isSavingReview ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <Save className="mr-2 h-3 w-3" />
                )}
                Save Review
              </Button>
              {!reviewed && (
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSkipMenu(!showSkipMenu)}
                    disabled={isSavingReview}
                    className="gap-1.5"
                  >
                    <SkipForward className="h-3 w-3" />
                    Skip VOD
                  </Button>
                  {showSkipMenu && (
                    <div className="absolute bottom-full left-0 mb-1 w-56 rounded-md border bg-popover p-1 shadow-md z-10">
                      {SKIP_REVIEW_REASONS.map((reason) => (
                        <button
                          key={reason}
                          onClick={() => handleSkipReview(reason)}
                          className="w-full text-left rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {match.reviewSkippedReason && (
              <p className="text-xs text-muted-foreground italic">
                Skipped: {match.reviewSkippedReason}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

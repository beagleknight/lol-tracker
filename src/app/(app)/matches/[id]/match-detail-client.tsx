"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  updateMatchComment,
  updateMatchReview,
} from "@/app/actions/matches";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  GraduationCap,
  Save,
} from "lucide-react";
import type { Match } from "@/db/schema";
import type { RiotMatch, RiotMatchParticipant } from "@/lib/riot-api";

interface MatchDetailClientProps {
  match: Match;
  rawMatch: RiotMatch | null;
  linkedSessions: Array<{
    sessionId: number;
    coachName: string;
    date: Date;
  }>;
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
}: {
  participant: RiotMatchParticipant;
  version: string;
  isUser: boolean;
}) {
  const cs = participant.totalMinionsKilled + participant.neutralMinionsKilled;
  const kda =
    participant.deaths === 0
      ? "Perfect"
      : ((participant.kills + participant.assists) / participant.deaths).toFixed(
          1
        );

  return (
    <TableRow className={isUser ? "bg-primary/5" : ""}>
      <TableCell>
        <div className="flex items-center gap-2">
          <Image
            src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${participant.championName}.png`}
            alt={participant.championName}
            width={28}
            height={28}
            className="rounded"
          />
          <div>
            <span
              className={`text-sm ${isUser ? "font-bold text-primary" : ""}`}
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
  rawMatch,
  linkedSessions,
  ddragonVersion,
  userPuuid,
}: MatchDetailClientProps) {
  const [comment, setComment] = useState(match.comment || "");
  const [reviewed, setReviewed] = useState(match.reviewed);
  const [reviewNotes, setReviewNotes] = useState(match.reviewNotes || "");
  const [isSavingComment, startSaveComment] = useTransition();
  const [isSavingReview, startSaveReview] = useTransition();

  function saveComment() {
    startSaveComment(async () => {
      const result = await updateMatchComment(match.id, comment);
      if (result.success) toast.success("Comment saved.");
    });
  }

  function saveReview() {
    startSaveReview(async () => {
      const result = await updateMatchReview(match.id, reviewed, reviewNotes);
      if (result.success) toast.success("Review saved.");
    });
  }

  // Split participants into teams
  const blueTeam = rawMatch?.info.participants.filter((p) => p.teamId === 100) || [];
  const redTeam = rawMatch?.info.participants.filter((p) => p.teamId === 200) || [];

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
              src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${match.championName}.png`}
              alt={match.championName}
              width={48}
              height={48}
              className="rounded"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{match.championName}</h1>
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
              <p className="text-sm text-muted-foreground">
                {formatDate(match.gameDate)} &middot;{" "}
                {formatDuration(match.gameDurationSeconds)} &middot;{" "}
                {match.runeKeystoneName}
                {match.matchupChampionName &&
                  ` vs ${match.matchupChampionName}`}
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
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold font-mono">
              {match.kills}/{match.deaths}/{match.assists}
            </p>
            <p className="text-xs text-muted-foreground">KDA</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{match.cs}</p>
            <p className="text-xs text-muted-foreground">
              CS ({match.csPerMin}/min)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">
              {((match.goldEarned || 0) / 1000).toFixed(1)}k
            </p>
            <p className="text-xs text-muted-foreground">Gold</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{match.visionScore}</p>
            <p className="text-xs text-muted-foreground">Vision</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">
              {formatDuration(match.gameDurationSeconds)}
            </p>
            <p className="text-xs text-muted-foreground">Duration</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{match.runeKeystoneName}</p>
            <p className="text-xs text-muted-foreground">Keystone</p>
          </CardContent>
        </Card>
      </div>

      {/* All 10 Players */}
      {rawMatch && (
        <div className="space-y-4">
          {[
            { team: blueTeam, label: "Blue Team", color: "text-blue-400" },
            { team: redTeam, label: "Red Team", color: "text-red-400" },
          ].map(({ team, label, color }) => (
            <Card key={label}>
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

      {/* Comment + Review Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Comment */}
        <Card>
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

        {/* Review */}
        <Card>
          <CardHeader>
            <CardTitle>VOD Review</CardTitle>
            <CardDescription>
              Notes from reviewing this game.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
              rows={4}
            />
            <Button size="sm" onClick={saveReview} disabled={isSavingReview}>
              {isSavingReview ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Save className="mr-2 h-3 w-3" />
              )}
              Save Review
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

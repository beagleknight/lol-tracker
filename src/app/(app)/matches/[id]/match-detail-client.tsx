"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  HighlightsDisplay,
  type HighlightItem,
} from "@/components/highlights-editor";
import {
  ArrowLeft,
  GraduationCap,
  ClipboardEdit,
  Link as LinkIcon,
  Eye,
  EyeOff,
  SkipForward,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import type { Match } from "@/db/schema";
import type { RiotMatchParticipant } from "@/lib/riot-api";
import { getKeystoneIconUrl, getChampionIconUrl } from "@/lib/riot-api";
import { ChampionLink } from "@/components/champion-link";

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
  match: Omit<Match, "rawMatchJson">;
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
          ? "bg-gold/5 border-l-2 border-l-gold/40"
          : isDuoPartner
            ? "bg-electric/5 border-l-2 border-l-electric/40"
            : "border-l-2 border-l-transparent"
      }
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <ChampionLink
            champion={participant.championName}
            ddragonVersion={version}
            linkTo={isUser ? "scout-your" : "scout-enemy"}
            showName={false}
            iconSize={28}
          />
          <div>
            <span
              className={`text-sm ${isUser ? "font-bold text-gold" : isDuoPartner ? "font-semibold text-electric" : ""}`}
            >
              {participant.riotIdGameName || participant.summonerName}
            </span>
            <ChampionLink
              champion={participant.championName}
              ddragonVersion={version}
              linkTo={isUser ? "scout-your" : "scout-enemy"}
              showIcon={false}
              textClassName="text-xs text-muted-foreground ml-1"
            />
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
  highlights,
  ddragonVersion,
  userPuuid,
}: MatchDetailClientProps) {
  // Split participants into teams
  const blueTeam = participants?.filter((p) => p.teamId === 100) || [];
  const redTeam = participants?.filter((p) => p.teamId === 200) || [];

  const hasHighlights = highlights.length > 0;
  const hasComment = !!match.comment;
  const hasVodUrl = !!match.vodUrl;
  const hasReviewNotes = !!match.reviewNotes;
  const hasAnyNotes = hasHighlights || hasComment || hasReviewNotes;

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
            <ChampionLink
              champion={match.championName}
              ddragonVersion={ddragonVersion}
              linkTo="scout-your"
              enemyChampion={match.matchupChampionName || undefined}
              showName={false}
              iconSize={48}
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gradient-gold">
                  <ChampionLink
                    champion={match.championName}
                    ddragonVersion={ddragonVersion}
                    linkTo="scout-your"
                    enemyChampion={match.matchupChampionName || undefined}
                    showIcon={false}
                    textClassName="text-xl font-bold text-gradient-gold"
                    className="hover:bg-accent/30"
                  />
                </h1>
                <Badge
                  variant={
                    match.result === "Victory" ? "default" : "destructive"
                  }
                >
                  {match.result}
                </Badge>
                {match.reviewed && (
                  <Badge variant="secondary" className="gap-1">
                    <Eye className="h-3 w-3" />
                    Reviewed
                  </Badge>
                )}
                {!match.reviewed && hasAnyNotes && (
                  <Badge variant="outline" className="gap-1 text-yellow-500 border-yellow-500/30">
                    <EyeOff className="h-3 w-3" />
                    Pending Review
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                {formatDate(match.gameDate)} &middot;{" "}
                {formatDuration(match.gameDurationSeconds)}
                {match.runeKeystoneName && (
                  <>
                    {" "}&middot;{" "}
                    {(() => {
                      const url = match.runeKeystoneId ? getKeystoneIconUrl(match.runeKeystoneId) : null;
                      return url ? (
                        <Image src={url} alt={match.runeKeystoneName} width={20} height={20} className="inline -my-0.5" />
                      ) : null;
                    })()}
                    {" "}{match.runeKeystoneName}
                  </>
                )}
                {match.matchupChampionName && (
                  <>
                    {" "}vs{" "}
                    <ChampionLink
                      champion={match.matchupChampionName}
                      ddragonVersion={ddragonVersion}
                      linkTo="scout-enemy"
                      yourChampion={match.championName}
                      iconSize={16}
                    />
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

      {/* Review this game CTA */}
      {!match.reviewed && (
        <div className="flex items-center gap-3 rounded-lg border border-gold/30 bg-gold/5 p-3">
          <ClipboardEdit className="h-5 w-5 text-gold shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {hasAnyNotes ? "This game has notes but hasn't been fully reviewed yet." : "This game hasn't been reviewed yet."}
            </p>
            <p className="text-xs text-muted-foreground">
              Head to the Review page to add highlights, notes, and VOD review.
            </p>
          </div>
          <Link href="/review">
            <Button size="sm" className="gap-1.5 shrink-0">
              <ClipboardEdit className="h-3.5 w-3.5" />
              Review
            </Button>
          </Link>
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
            <p className="text-2xl font-bold flex items-center justify-center gap-2">
              {match.runeKeystoneName ? (
                <>
                  {(() => {
                    const url = match.runeKeystoneId ? getKeystoneIconUrl(match.runeKeystoneId) : null;
                    return url ? (
                      <Image src={url} alt={match.runeKeystoneName} width={36} height={36} />
                    ) : null;
                  })()}
                  {match.runeKeystoneName}
                </>
              ) : (
                <span className="text-muted-foreground">&mdash;</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">Keystone</p>
          </CardContent>
        </Card>
      </div>

      {/* Highlights / Lowlights — promoted above player tables for visibility */}
      {hasHighlights && (
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle>Highlights & Lowlights</CardTitle>
          </CardHeader>
          <CardContent>
            <HighlightsDisplay highlights={highlights} />
          </CardContent>
        </Card>
      )}

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

      {/* Notes & Review Section — read-only */}
      {(hasComment || hasVodUrl || hasReviewNotes || match.reviewed) && (
        <>
          <Separator />

          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Game Notes — read-only */}
              {hasComment && (
                <Card className="surface-glow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Game Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap text-foreground/80 leading-relaxed">
                      {match.comment}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* VOD & Review — read-only */}
              {(hasVodUrl || hasReviewNotes || match.reviewed) && (
                <Card className="surface-glow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      VOD Review
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* VOD URL */}
                    {hasVodUrl && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <LinkIcon className="h-3 w-3" />
                          Ascent VOD
                        </p>
                        <a
                          href={match.vodUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-electric hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open VOD
                        </a>
                      </div>
                    )}

                    {/* Review notes */}
                    {hasReviewNotes && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Review Notes
                        </p>
                        <p className="text-sm whitespace-pre-wrap text-foreground/80 leading-relaxed">
                          {match.reviewNotes}
                        </p>
                      </div>
                    )}

                    {/* Skip reason */}
                    {match.reviewSkippedReason && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic">
                        <SkipForward className="h-3 w-3" />
                        Skipped: {match.reviewSkippedReason}
                      </div>
                    )}

                    {/* Review status badge */}
                    {match.reviewed && !hasReviewNotes && !match.reviewSkippedReason && (
                      <p className="text-xs text-green-400 flex items-center gap-1.5">
                        <Eye className="h-3 w-3" />
                        Marked as reviewed
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

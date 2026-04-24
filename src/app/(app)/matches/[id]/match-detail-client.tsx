"use client";

import {
  GraduationCap,
  ClipboardEdit,
  Link as LinkIcon,
  Eye,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import type { MatchupNoteData } from "@/app/actions/matchup-notes";
import type { Match } from "@/db/schema";
import type { RiotMatchParticipant } from "@/lib/riot-api";

import { ReadOnlyMatchupNotes } from "@/app/(app)/scout/matchup-notes";
import { generatePostGameInsight, type InsightResult } from "@/app/actions/ai-insights";
import { AiInsightDrawer } from "@/components/ai-insight-card";
import { BackButton } from "@/components/back-button";
import { ChampionLink } from "@/components/champion-link";
import { HighlightsDisplay, type HighlightItem } from "@/components/highlights-editor";
import { ItemIcon } from "@/components/icons/item-icon";
import { RuneIcon } from "@/components/icons/rune-icon";
import { MarkdownDisplay } from "@/components/markdown-display";
import { PositionIcon, getRoleRelevance, getPositionLabel } from "@/components/position-icon";
import { ResultBadge } from "@/components/result-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-client";
import { formatDate, formatDuration, DEFAULT_LOCALE } from "@/lib/format";
import { safeExternalUrl } from "@/lib/url";

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
  matchupNotes: MatchupNoteData[];
  ddragonVersion: string;
  userPuuid: string;
  userPrimaryRole?: string | null;
  isAiConfigured: boolean;
  cachedAiInsight: InsightResult | null;
  readOnly?: boolean;
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
  const t = useTranslations("MatchDetail");
  const cs = participant.totalMinionsKilled + participant.neutralMinionsKilled;
  const kda =
    participant.deaths === 0
      ? t("perfectKda")
      : ((participant.kills + participant.assists) / participant.deaths).toFixed(1);

  return (
    <TableRow
      className={
        isUser
          ? "border-l-2 border-l-gold/40 bg-gold/5"
          : isDuoPartner
            ? "border-l-2 border-l-electric/40 bg-electric/5"
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
      <TableCell className="text-center font-mono text-sm text-muted-foreground">{kda}</TableCell>
      <TableCell className="text-center font-mono text-sm">{cs}</TableCell>
      <TableCell className="hidden text-center font-mono text-sm text-muted-foreground sm:table-cell">
        {participant.visionScore}
      </TableCell>
      <TableCell className="hidden text-center font-mono text-sm sm:table-cell">
        {(participant.goldEarned / 1000).toFixed(1)}k
      </TableCell>
      <TableCell className="hidden text-center font-mono text-sm text-muted-foreground sm:table-cell">
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
              <ItemIcon key={i} itemId={itemId} alt={t("itemAlt", { itemId })} />
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
  matchupNotes,
  ddragonVersion,
  userPuuid,
  userPrimaryRole,
  isAiConfigured,
  cachedAiInsight,
  readOnly,
}: MatchDetailClientProps) {
  const { user } = useAuth();
  const isReadOnly = readOnly || user?.isDemoUser;
  const locale = user?.locale ?? DEFAULT_LOCALE;
  const t = useTranslations("MatchDetail");
  const tAi = useTranslations("AiInsights");

  // Role relevance
  const roleRelevance = getRoleRelevance(match.position, userPrimaryRole);
  const isOffRole = roleRelevance === "off-role";

  // Split participants into teams
  const blueTeam = participants?.filter((p) => p.teamId === 100) || [];
  const redTeam = participants?.filter((p) => p.teamId === 200) || [];

  const hasHighlights = highlights.length > 0;
  const hasComment = !!match.comment;
  const hasVodUrl = !!match.vodUrl;
  const hasAnyNotes = hasHighlights || hasComment;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton />
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
                <h1 className="text-gradient-gold text-xl font-bold">
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
                <ResultBadge result={match.result} format="long" />
                {match.reviewed && (
                  <Badge variant="secondary" className="gap-1">
                    <Eye className="h-3 w-3" />
                    {t("reviewed")}
                  </Badge>
                )}
                {!match.reviewed && !isOffRole && (
                  <Badge variant="outline" className="gap-1 border-warning/30 text-warning">
                    {t("pendingReview")}
                  </Badge>
                )}
                {!isReadOnly && (
                  <AiInsightDrawer
                    title={tAi("postGameTitle")}
                    cachedInsight={cachedAiInsight}
                    isConfigured={isAiConfigured}
                    locale={locale}
                    onGenerate={(forceRegenerate) =>
                      generatePostGameInsight(match.id, forceRegenerate)
                    }
                  />
                )}
              </div>
              <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                {match.position && (
                  <>
                    <PositionIcon
                      position={match.position}
                      size={16}
                      className={`-my-0.5 inline ${roleRelevance === "main" ? "text-gold" : roleRelevance === "off-role" ? "text-warning" : "text-muted-foreground"}`}
                      aria-hidden="true"
                    />
                    <span className={isOffRole ? "text-warning" : ""}>
                      {getPositionLabel(match.position)}
                    </span>
                    {isOffRole && (
                      <Badge
                        variant="outline"
                        className="border-warning/30 px-1.5 py-0 text-[10px] text-warning"
                      >
                        {t("offRole")}
                      </Badge>
                    )}
                    &middot;{" "}
                  </>
                )}
                {formatDate(match.gameDate, locale, "datetime")} &middot;{" "}
                {formatDuration(match.gameDurationSeconds)}
                {match.runeKeystoneName && (
                  <>
                    {" "}
                    &middot;{" "}
                    {match.runeKeystoneId && (
                      <RuneIcon
                        keystoneId={match.runeKeystoneId}
                        alt={match.runeKeystoneName}
                        size={20}
                        className="-my-0.5 inline"
                      />
                    )}{" "}
                    {match.runeKeystoneName}
                  </>
                )}
                {match.matchupChampionName && (
                  <>
                    {" "}
                    {t("vs")}{" "}
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
                {t("reviewedWithCoach", { coachName: s.coachName })}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Review this game CTA — hidden for off-role matches and readOnly */}
      {!isReadOnly && !match.reviewed && !isOffRole && (
        <div className="flex items-center gap-3 rounded-lg border border-gold/30 bg-gold/5 p-3">
          <ClipboardEdit className="h-5 w-5 shrink-0 text-gold" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {hasAnyNotes ? t("reviewCtaWithNotes") : t("reviewCtaWithoutNotes")}
            </p>
            <p className="text-xs text-muted-foreground">{t("reviewCtaSubtext")}</p>
          </div>
          <Link href={`/review?tab=pending&matchId=${match.id}`}>
            <Button size="sm" className="shrink-0 gap-1.5">
              <ClipboardEdit className="h-3.5 w-3.5" />
              {t("reviewButton")}
            </Button>
          </Link>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        <Card className="surface-glow">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="font-mono text-2xl font-bold text-gold">
              {match.kills}/{match.deaths}/{match.assists}
            </p>
            <p className="text-xs text-muted-foreground">{t("kda")}</p>
          </CardContent>
        </Card>
        <Card className="surface-glow">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="font-mono text-2xl font-bold text-gold">{match.cs}</p>
            <p className="text-xs text-muted-foreground">
              {t("csWithPerMin", { csPerMin: match.csPerMin ?? 0 })}
            </p>
          </CardContent>
        </Card>
        <Card className="surface-glow">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="font-mono text-2xl font-bold text-gold">
              {((match.goldEarned || 0) / 1000).toFixed(1)}k
            </p>
            <p className="text-xs text-muted-foreground">{t("gold")}</p>
          </CardContent>
        </Card>
        <Card className="surface-glow">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="font-mono text-2xl font-bold text-gold">{match.visionScore}</p>
            <p className="text-xs text-muted-foreground">{t("vision")}</p>
          </CardContent>
        </Card>
        <Card className="surface-glow">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="font-mono text-2xl font-bold">
              {formatDuration(match.gameDurationSeconds)}
            </p>
            <p className="text-xs text-muted-foreground">{t("duration")}</p>
          </CardContent>
        </Card>
        <Card className="surface-glow">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="flex items-center justify-center gap-2 text-2xl font-bold">
              {match.runeKeystoneName ? (
                <>
                  {match.runeKeystoneId && (
                    <RuneIcon
                      keystoneId={match.runeKeystoneId}
                      alt={match.runeKeystoneName}
                      size={36}
                    />
                  )}
                  {match.runeKeystoneName}
                </>
              ) : (
                <span className="text-muted-foreground">&mdash;</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">{t("keystone")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Review — unified card with highlights, notes, and VOD */}
      {match.reviewed && hasAnyNotes && (
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {t("review")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasHighlights && <HighlightsDisplay highlights={highlights} />}

            {hasHighlights && (hasComment || hasVodUrl) && <Separator />}

            {hasComment && (
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  {t("gameNotes")}
                </p>
                <MarkdownDisplay content={match.comment!} />
              </div>
            )}

            {hasVodUrl && (
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <LinkIcon className="h-3 w-3" />
                  {t("ascentVod")}
                </p>
                <a
                  href={safeExternalUrl(match.vodUrl) ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-electric hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t("openVod")}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Matchup Notes — read-only reference */}
      {matchupNotes.length > 0 && match.matchupChampionName && (
        <Card className="surface-glow">
          <CardContent className="pt-5">
            <ReadOnlyMatchupNotes
              notes={matchupNotes}
              matchupChampionName={match.matchupChampionName}
              yourChampionName={match.championName}
              locale={locale}
            />
          </CardContent>
        </Card>
      )}

      {/* All 10 Players */}
      {participants && (
        <div className="space-y-4">
          {[
            { team: blueTeam, label: t("blueTeam"), color: "text-electric" },
            { team: redTeam, label: t("redTeam"), color: "text-destructive" },
          ].map(({ team, label, color }) => (
            <Card key={label} className="surface-glow">
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm ${color}`}>{label}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("playerColumn")}</TableHead>
                      <TableHead className="text-center">{t("kdaColumn")}</TableHead>
                      <TableHead className="text-center">{t("ratioColumn")}</TableHead>
                      <TableHead className="text-center">{t("csColumn")}</TableHead>
                      <TableHead className="hidden text-center sm:table-cell">
                        {t("visionColumn")}
                      </TableHead>
                      <TableHead className="hidden text-center sm:table-cell">
                        {t("goldColumn")}
                      </TableHead>
                      <TableHead className="hidden text-center sm:table-cell">
                        {t("damageColumn")}
                      </TableHead>
                      <TableHead>{t("itemsColumn")}</TableHead>
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
    </div>
  );
}

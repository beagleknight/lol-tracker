"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSyncMatches } from "@/hooks/use-sync-matches";
import {
  updateMatchComment,
  updateMatchReview,
} from "@/app/actions/matches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  RefreshCw,
  Search,
  MessageSquare,
  Eye,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { Match } from "@/db/schema";

interface MatchesClientProps {
  matches: Match[];
  ddragonVersion: string;
  isRiotLinked: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function ChampionIcon({
  championName,
  version,
  size = 28,
}: {
  championName: string;
  version: string;
  size?: number;
}) {
  return (
    <Image
      src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championName}.png`}
      alt={championName}
      width={size}
      height={size}
      className="rounded"
    />
  );
}

// ─── Inline Comment Editor ──────────────────────────────────────────────────

function CommentEditor({
  matchId,
  initialComment,
}: {
  matchId: string;
  initialComment: string | null;
}) {
  const [comment, setComment] = useState(initialComment || "");
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function save() {
    startTransition(async () => {
      const result = await updateMatchComment(matchId, comment);
      if (result.success) {
        toast.success("Comment saved.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
          />
        }
      >
        <MessageSquare className="h-3 w-3" />
        {initialComment ? "Edit" : "Add"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Match Comment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What happened this game? What could you improve?"
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline Review Editor ───────────────────────────────────────────────────

function ReviewEditor({
  matchId,
  initialReviewed,
  initialNotes,
}: {
  matchId: string;
  initialReviewed: boolean;
  initialNotes: string | null;
}) {
  const [reviewed, setReviewed] = useState(initialReviewed);
  const [notes, setNotes] = useState(initialNotes || "");
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function save() {
    startTransition(async () => {
      const result = await updateMatchReview(matchId, reviewed, notes);
      if (result.success) {
        toast.success("Review saved.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
          />
        }
      >
        <Eye className="h-3 w-3" />
        {initialReviewed ? "Reviewed" : "Review"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review Game</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="reviewed"
              checked={reviewed}
              onCheckedChange={(v) => setReviewed(!!v)}
            />
            <label htmlFor="reviewed" className="text-sm">
              Mark as reviewed
            </label>
          </div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes from your review (takeaways, patterns noticed...)"
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Matches Client ────────────────────────────────────────────────────

export function MatchesClient({
  matches: initialMatches,
  ddragonVersion,
  isRiotLinked,
}: MatchesClientProps) {
  const { isSyncing, handleSync } = useSyncMatches();
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [reviewFilter, setReviewFilter] = useState<string>("all");

  // Unique champion names for filter
  const champions = useMemo(() => {
    const names = new Set(initialMatches.map((m) => m.championName));
    return Array.from(names).sort();
  }, [initialMatches]);

  const [championFilter, setChampionFilter] = useState<string>("all");

  // Filter matches
  const filteredMatches = useMemo(() => {
    return initialMatches.filter((m) => {
      if (resultFilter !== "all" && m.result !== resultFilter) return false;
      if (championFilter !== "all" && m.championName !== championFilter)
        return false;
      if (reviewFilter === "reviewed" && !m.reviewed) return false;
      if (reviewFilter === "unreviewed" && m.reviewed) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesSearch =
          m.championName.toLowerCase().includes(q) ||
          m.matchupChampionName?.toLowerCase().includes(q) ||
          m.runeKeystoneName?.toLowerCase().includes(q) ||
          m.comment?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [initialMatches, resultFilter, championFilter, reviewFilter, search]);

  // Stats
  const wins = filteredMatches.filter((m) => m.result === "Victory").length;
  const losses = filteredMatches.filter((m) => m.result === "Defeat").length;
  const winRate =
    filteredMatches.length > 0
      ? Math.round((wins / filteredMatches.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">Matches</h1>
          <p className="text-muted-foreground">
            {filteredMatches.length} game{filteredMatches.length !== 1 ? "s" : ""}{" "}
            &middot; {wins}W {losses}L ({winRate}%)
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={isSyncing || !isRiotLinked}
          className="shrink-0"
        >
          {isSyncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync Games
        </Button>
      </div>

      {!isRiotLinked && (
        <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-gold-light">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Link your Riot account in{" "}
            <Link href="/settings" className="underline font-medium">
              Settings
            </Link>{" "}
            to sync games.
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search champion, matchup, rune, comment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={resultFilter} onValueChange={(v) => setResultFilter(v ?? "all")}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Result" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Results</SelectItem>
            <SelectItem value="Victory">Victories</SelectItem>
            <SelectItem value="Defeat">Defeats</SelectItem>
          </SelectContent>
        </Select>
        <Select value={championFilter} onValueChange={(v) => setChampionFilter(v ?? "all")}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Champion" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Champions</SelectItem>
            {champions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reviewFilter} onValueChange={(v) => setReviewFilter(v ?? "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Review" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="unreviewed">Not Reviewed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredMatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <p className="text-muted-foreground">
            {initialMatches.length === 0
              ? "No matches synced yet. Click Sync Games to get started."
              : "No matches match your filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border surface-glow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">Date</TableHead>
                <TableHead className="w-[80px]">Result</TableHead>
                <TableHead>Champion</TableHead>
                <TableHead>Rune</TableHead>
                <TableHead>Matchup</TableHead>
                <TableHead className="text-center">KDA</TableHead>
                <TableHead className="text-center">CS</TableHead>
                <TableHead className="text-center">Duration</TableHead>
                <TableHead className="w-[100px]">Notes</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMatches.map((match) => (
                <TableRow
                  key={match.id}
                  className={
                    match.result === "Victory"
                      ? "border-l-2 border-l-green-500/50"
                      : "border-l-2 border-l-red-500/50"
                  }
                >
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(match.gameDate)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        match.result === "Victory" ? "default" : "destructive"
                      }
                      className="text-xs"
                    >
                      {match.result === "Victory" ? "W" : "L"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ChampionIcon
                        championName={match.championName}
                        version={ddragonVersion}
                      />
                      <span className="text-sm">{match.championName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {match.runeKeystoneName || "—"}
                  </TableCell>
                  <TableCell>
                    {match.matchupChampionName ? (
                      <div className="flex items-center gap-2">
                        <ChampionIcon
                          championName={match.matchupChampionName}
                          version={ddragonVersion}
                          size={24}
                        />
                        <span className="text-sm">
                          {match.matchupChampionName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-mono">
                      {match.kills}/{match.deaths}/{match.assists}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-mono">
                      {match.cs}
                      <span className="text-muted-foreground text-xs ml-1">
                        ({match.csPerMin}/m)
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {formatDuration(match.gameDurationSeconds)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <CommentEditor
                        matchId={match.id}
                        initialComment={match.comment}
                      />
                      <ReviewEditor
                        matchId={match.id}
                        initialReviewed={match.reviewed}
                        initialNotes={match.reviewNotes}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link href={`/matches/${match.id}`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

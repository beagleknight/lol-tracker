"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import type { Match } from "@/db/schema";
import { getChampionIconUrl } from "@/lib/riot-api";
import { MatchCard, type MatchHighlightData } from "@/components/match-card";
import { DEFAULT_LOCALE } from "@/lib/format";

interface MatchesClientProps {
  matches: Match[];
  ddragonVersion: string;
  isRiotLinked: boolean;
  highlightsPerMatch: Record<string, MatchHighlightData[]>;
  // Server pagination
  currentPage: number;
  totalPages: number;
  totalMatches: number;
  wins: number;
  losses: number;
  champions: string[];
  filters: {
    search: string;
    result: string;
    champion: string;
    review: string;
  };
}

// ─── URL helper ─────────────────────────────────────────────────────────────

function buildMatchesUrl(
  params: Record<string, string>,
  overrides: Record<string, string>
): string {
  const merged = { ...params, ...overrides };
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    // Omit defaults to keep URLs clean
    if (key === "page" && value === "1") continue;
    if (key === "result" && value === "all") continue;
    if (key === "champion" && value === "all") continue;
    if (key === "review" && value === "all") continue;
    if (key === "search" && value === "") continue;
    if (value) sp.set(key, value);
  }
  const qs = sp.toString();
  return `/matches${qs ? `?${qs}` : ""}`;
}

// ─── Server Pagination ──────────────────────────────────────────────────────

function ServerPagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (totalPages <= 1) return null;

  // Build page numbers: first, last, current +/- 1, with ellipsis
  const pages: (number | "ellipsis")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={currentPage === 1 || disabled}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground">
            ...
          </span>
        ) : (
          <Button
            key={p}
            variant={p === currentPage ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8 text-xs"
            disabled={disabled}
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        )
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={currentPage === totalPages || disabled}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Main Matches Client ────────────────────────────────────────────────────

export function MatchesClient({
  matches: pageMatches,
  ddragonVersion,
  isRiotLinked,
  highlightsPerMatch,
  currentPage,
  totalPages,
  totalMatches,
  wins,
  losses,
  champions,
  filters,
}: MatchesClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const locale = session?.user?.locale ?? DEFAULT_LOCALE;
  const [isNavigating, startTransition] = useTransition();

  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  // Current filter params for URL building
  const currentParams: Record<string, string> = {
    search: filters.search,
    result: filters.result,
    champion: filters.champion,
    review: filters.review,
    page: String(currentPage),
  };

  function navigateWithFilter(key: string, value: string) {
    const url = buildMatchesUrl(currentParams, { [key]: value, page: "1" });
    startTransition(() => {
      router.push(url, { scroll: false });
    });
  }

  function navigateToPage(page: number) {
    const url = buildMatchesUrl(currentParams, { page: String(page) });
    startTransition(() => {
      router.push(url, { scroll: false });
    });
  }


  // Debounced search — navigate after typing stops
  const [searchValue, setSearchValue] = useState(filters.search);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const debouncedSearch = useCallback(
    (value: string) => {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        navigateWithFilter("search", value);
      }, 400);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.result, filters.champion, filters.review]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">Matches</h1>
          <p className="text-muted-foreground">
            {totalMatches} game{totalMatches !== 1 ? "s" : ""}{" "}
            &middot; {wins}W {losses}L ({winRate}%)
          </p>
        </div>
      </div>

      {!isRiotLinked && (
        <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-gold-light">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Link your Riot account in{" "}
            <Link href="/settings" className="underline font-medium">
              Settings
            </Link>{" "}
            to import games.
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search champion, matchup, notes..."
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              debouncedSearch(e.target.value);
            }}
            className="pl-9"
          />
        </div>
        <Select value={filters.result} onValueChange={(v) => navigateWithFilter("result", v ?? "all")}>
          <SelectTrigger className="w-full sm:w-[130px]">
            <SelectValue placeholder="Result" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Results</SelectItem>
            <SelectItem value="Victory">Victories</SelectItem>
            <SelectItem value="Defeat">Defeats</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.champion} onValueChange={(v) => navigateWithFilter("champion", v ?? "all")}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Champion" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Champions</SelectItem>
            {champions.map((c) => (
              <SelectItem key={c} value={c}>
                <span className="inline-flex items-center gap-1.5">
                  <Image
                    src={getChampionIconUrl(ddragonVersion, c)}
                    alt={c}
                    width={16}
                    height={16}
                    className="rounded"
                  />
                  {c}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.review} onValueChange={(v) => navigateWithFilter("review", v ?? "all")}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Review" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="unreviewed">Not Reviewed</SelectItem>
            <SelectItem value="has-notes">Has Notes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Match Cards */}
      {totalMatches === 0 && !isNavigating ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <p className="text-muted-foreground">
            {filters.search || filters.result !== "all" || filters.champion !== "all" || filters.review !== "all"
              ? "No games match your filters."
              : "No matches yet. Click Update Games to get started."}
          </p>
        </div>
      ) : (
        <>
          <div className="relative">
            {isNavigating && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-lg">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className={`space-y-2 transition-opacity duration-150 ${isNavigating ? "opacity-40" : ""}`}>
              {pageMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  ddragonVersion={ddragonVersion}
                  matchHighlights={highlightsPerMatch[match.id] || []}
                  locale={locale}
                />
              ))}
            </div>
          </div>
          <ServerPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={navigateToPage}
            disabled={isNavigating}
          />
        </>
      )}
    </div>
  );
}

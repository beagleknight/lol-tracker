"use client";

import {
  Search,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Download,
  Crosshair,
  Globe,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useTransition, useCallback } from "react";

import type { Match } from "@/db/schema";

import { EmptyState } from "@/components/empty-state";
import { MatchCard, type MatchHighlightData } from "@/components/match-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-client";
import { DEFAULT_LOCALE } from "@/lib/format";
import { getChampionIconUrl } from "@/lib/riot-api";

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
  overrides: Record<string, string>,
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

function buildExportUrl(filters: {
  search: string;
  result: string;
  champion: string;
  review: string;
}): string {
  const sp = new URLSearchParams();
  if (filters.search) sp.set("search", filters.search);
  if (filters.result !== "all") sp.set("result", filters.result);
  if (filters.champion !== "all") sp.set("champion", filters.champion);
  if (filters.review !== "all") sp.set("review", filters.review);
  const qs = sp.toString();
  return `/api/export/matches${qs ? `?${qs}` : ""}`;
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
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
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
        aria-label="Previous page"
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
        ),
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={currentPage === totalPages || disabled}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
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
  const { user } = useAuth();
  const locale = user?.locale ?? DEFAULT_LOCALE;
  const t = useTranslations("Matches");
  const [isNavigating, startTransition] = useTransition();

  const meaningfulGames = wins + losses;
  const winRate = meaningfulGames > 0 ? Math.round((wins / meaningfulGames) * 100) : 0;

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
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [filters.result, filters.champion, filters.review],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-in-up flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("heading")}</h1>
          <p className="text-muted-foreground">
            {t("summary", { totalMatches, wins, losses, winRate })}
          </p>
        </div>
        {totalMatches > 0 && (
          <a
            href={buildExportUrl(filters)}
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("exportCsv")}
          </a>
        )}
      </div>

      {!isRiotLinked && (
        <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-gold-light">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {t.rich("linkRiotAccount", {
              link: (chunks) => (
                <Link href="/settings" className="font-medium underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </div>
      )}

      {isRiotLinked && !user?.primaryRole && (
        <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-gold-light">
          <Crosshair className="h-4 w-4 shrink-0" />
          <span>
            {t.rich("setRolePreferences", {
              link: (chunks) => (
                <Link href="/settings" className="font-medium underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </div>
      )}

      {isRiotLinked && !user?.region && (
        <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm text-gold-light">
          <Globe className="h-4 w-4 shrink-0" />
          <span>
            {t.rich("selectRegion", {
              link: (chunks) => (
                <Link href="/settings" className="font-medium underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              debouncedSearch(e.target.value);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={filters.result}
          onValueChange={(v) => navigateWithFilter("result", v ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-[130px]" aria-label="Filter by result">
            <SelectValue placeholder={t("resultFilterPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allResults")}</SelectItem>
            <SelectItem value="Victory">{t("victories")}</SelectItem>
            <SelectItem value="Defeat">{t("defeats")}</SelectItem>
            <SelectItem value="Remake">{t("remakes")}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.champion}
          onValueChange={(v) => navigateWithFilter("champion", v ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-[150px]" aria-label="Filter by champion">
            <SelectValue placeholder={t("championFilterPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allChampions")}</SelectItem>
            {champions.map((c) => (
              <SelectItem key={c} value={c}>
                <span className="inline-flex items-center gap-1.5">
                  <Image
                    src={getChampionIconUrl(ddragonVersion, c)}
                    alt={c}
                    width={16}
                    height={16}
                    unoptimized
                    className="rounded"
                  />
                  {c}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.review}
          onValueChange={(v) => navigateWithFilter("review", v ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by review status">
            <SelectValue placeholder={t("reviewFilterPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("reviewAll")}</SelectItem>
            <SelectItem value="reviewed">{t("reviewed")}</SelectItem>
            <SelectItem value="unreviewed">{t("notReviewed")}</SelectItem>
            <SelectItem value="has-notes">{t("hasNotes")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Match Cards */}
      {totalMatches === 0 && !isNavigating ? (
        <EmptyState
          title={
            filters.search ||
            filters.result !== "all" ||
            filters.champion !== "all" ||
            filters.review !== "all"
              ? t("noMatchesFiltered")
              : t("noMatchesEmpty")
          }
          className="py-12"
        />
      ) : (
        <>
          <div className="relative">
            {isNavigating && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <div
              className={`space-y-2 transition-opacity duration-150 ${isNavigating ? "opacity-40" : ""}`}
            >
              {pageMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  ddragonVersion={ddragonVersion}
                  matchHighlights={highlightsPerMatch[match.id] || []}
                  locale={locale}
                  userPrimaryRole={user?.primaryRole}
                  userSecondaryRole={user?.secondaryRole}
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

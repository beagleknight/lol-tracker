import seasonsData from "./seasons.json";

export interface Season {
  id: string;
  name: string;
  seasonNumber: number;
  year: number;
  actIStart: string;
  actIIStart: string;
  endDate: string | null;
}

export interface DateRange {
  start: Date;
  end: Date | null;
}

/** All known seasons for the current cycle. */
export function getSeasons(): Season[] {
  return seasonsData.seasons as Season[];
}

/** Find a season by its ID (e.g. "2026-s1"). */
export function getSeasonById(id: string): Season | undefined {
  return seasonsData.seasons.find((s) => s.id === id) as Season | undefined;
}

/**
 * Parse a season filter value into a date range.
 *
 * Filter values:
 * - "all"                       → null (no filtering)
 * - "2026"                      → full annual cycle (cycleStart → end of last season or now)
 * - "2026-s1", "2026-s2", etc.  → specific season dates
 * - "custom:YYYY-MM-DD:YYYY-MM-DD" → arbitrary date range
 */
export function getDateRange(filter: string): DateRange | null {
  if (filter === "all") return null;

  if (filter === "2026") {
    const start = new Date(seasonsData.cycleStart);
    // End is end of the last known season, or null if ongoing
    const lastSeason = seasonsData.seasons[seasonsData.seasons.length - 1];
    const end = lastSeason?.endDate ? new Date(lastSeason.endDate) : null;
    return { start, end };
  }

  const season = getSeasonById(filter);
  if (season) {
    return {
      start: new Date(season.actIStart),
      end: season.endDate ? new Date(season.endDate) : null,
    };
  }

  // Custom range: "custom:2026-01-01:2026-03-31"
  if (filter.startsWith("custom:")) {
    const parts = filter.split(":");
    if (parts.length === 3) {
      const start = new Date(parts[1]);
      const end = new Date(parts[2]);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        return { start, end };
      }
    }
  }

  return null;
}

/** Default filter value. */
export const DEFAULT_SEASON_FILTER = "all";

/** Cookie name for persisting the season filter. */
export const SEASON_FILTER_COOKIE = "season-filter";

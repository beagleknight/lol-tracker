import { cookies } from "next/headers";

import {
  DEFAULT_SEASON_FILTER,
  getDateRange,
  SEASON_FILTER_COOKIE,
  type DateRange,
} from "./seasons";

/**
 * Read the season filter from cookies (server-side only).
 * Returns the parsed date range, or null for "all time".
 */
export async function getSeasonDateRange(): Promise<DateRange | null> {
  const cookieStore = await cookies();
  const filter = cookieStore.get(SEASON_FILTER_COOKIE)?.value ?? DEFAULT_SEASON_FILTER;
  return getDateRange(filter);
}

/**
 * Read the raw season filter value from cookies.
 */
export async function getSeasonFilterValue(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get(SEASON_FILTER_COOKIE)?.value ?? DEFAULT_SEASON_FILTER;
}

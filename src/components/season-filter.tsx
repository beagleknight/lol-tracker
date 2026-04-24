"use client";

import type { DateRange as RDPDateRange } from "react-day-picker";

import { Calendar, ChevronDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const DayPicker = dynamic(() => import("react-day-picker").then((m) => m.DayPicker), {
  ssr: false,
  loading: () => <div className="h-[280px] w-full" />,
});

import { setSeasonFilter } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getSeasons, getDateRange } from "@/lib/seasons";
import { cn } from "@/lib/utils";

interface SeasonFilterProps {
  currentFilter: string;
}

/** Format a date as "Jan 8" or "Jan 8, 2026" */
function shortDate(d: Date, includeYear = false): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (includeYear) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}

/** Get display label for the current filter value. */
function getFilterLabel(filter: string, t: ReturnType<typeof useTranslations>): string {
  if (filter === "all") return t("allTime");
  if (filter === "2026") return t("cycle2026");

  const seasons = getSeasons();
  const season = seasons.find((s) => s.id === filter);
  if (season) return `${season.year}/S${season.seasonNumber} ${season.name}`;

  if (filter.startsWith("custom:")) {
    const range = getDateRange(filter);
    if (range) {
      const start = shortDate(range.start);
      const end = range.end ? shortDate(range.end) : t("now");
      return `${start} – ${end}`;
    }
  }

  return t("allTime");
}

export function SeasonFilter({ currentFilter }: SeasonFilterProps) {
  const t = useTranslations("SeasonFilter");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState<RDPDateRange | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);

  const seasons = getSeasons();
  const label = getFilterLabel(currentFilter, t);
  const isFiltered = currentFilter !== "all";

  function handleSelect(value: string) {
    if (value === "custom") {
      setShowDatePicker(true);
      return;
    }
    setFilterOpen(false);
    startTransition(async () => {
      await setSeasonFilter(value);
      router.refresh();
    });
  }

  function handleCustomApply() {
    if (!dateRange?.from) return;
    const from = dateRange.from.toISOString().split("T")[0];
    const to = dateRange.to ? dateRange.to.toISOString().split("T")[0] : from;
    const value = `custom:${from}:${to}`;
    setShowDatePicker(false);
    setFilterOpen(false);
    startTransition(async () => {
      await setSeasonFilter(value);
      router.refresh();
    });
  }

  function handleClear() {
    startTransition(async () => {
      await setSeasonFilter("all");
      router.refresh();
    });
  }

  const filterOptions = [
    { value: "all", label: t("allTime") },
    { value: "2026", label: t("cycle2026") },
    ...seasons.map((s) => ({
      value: s.id,
      label: `${s.year}/S${s.seasonNumber} ${s.name}`,
    })),
    { value: "custom", label: t("customRange") },
  ];

  return (
    <div className="flex items-center gap-1">
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all",
            isFiltered
              ? "bg-gold/10 text-gold ring-1 ring-gold/20"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            isPending && "opacity-50",
          )}
        >
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 truncate text-left">{label}</span>
          {isFiltered ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="shrink-0 rounded-sm p-0.5 hover:bg-gold/20"
              aria-label={t("clearFilter")}
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          )}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          sideOffset={8}
          className={cn("p-1", showDatePicker ? "w-64" : "w-56")}
        >
          {!showDatePicker ? (
            <div className="flex flex-col">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "flex items-center rounded-md px-2.5 py-1.5 text-xs transition-colors",
                    currentFilter === option.value
                      ? "bg-gold/10 font-medium text-gold"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-2">
              <DayPicker
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                captionLayout="dropdown"
                defaultMonth={new Date(2026, 0)}
                startMonth={new Date(2024, 0)}
                endMonth={new Date(2027, 11)}
                classNames={{
                  root: "text-sm",
                  months: "flex flex-col",
                  month: "space-y-3",
                  month_caption: "flex items-center justify-center gap-1 py-1",
                  caption_label: "hidden",
                  dropdowns: "flex items-center gap-1",
                  dropdown:
                    "rounded border border-border bg-background px-1.5 py-0.5 text-xs cursor-pointer",
                  nav: "hidden",
                  button_previous: "hidden",
                  button_next: "hidden",
                  weekdays: "flex",
                  weekday: "w-8 text-xs font-normal text-muted-foreground text-center",
                  week: "flex",
                  day: "h-8 w-8 text-center p-0",
                  day_button:
                    "h-8 w-8 rounded text-xs hover:bg-accent inline-flex items-center justify-center cursor-pointer",
                  selected: "bg-gold/20 text-gold",
                  range_start: "bg-gold text-gold-foreground rounded-l-md",
                  range_end: "bg-gold text-gold-foreground rounded-r-md",
                  range_middle: "bg-gold/10",
                  today: "font-bold ring-1 ring-gold/30",
                  outside: "opacity-30",
                  chevron: "h-4 w-4",
                }}
              />
              <div className="flex gap-2 border-t border-border pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 flex-1 text-xs"
                  onClick={() => {
                    setShowDatePicker(false);
                    setDateRange(undefined);
                  }}
                >
                  {t("cancel")}
                </Button>
                <Button
                  size="sm"
                  className="h-7 flex-1 text-xs"
                  onClick={handleCustomApply}
                  disabled={!dateRange?.from}
                >
                  {t("apply")}
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

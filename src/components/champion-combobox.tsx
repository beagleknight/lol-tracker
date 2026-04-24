"use client";

import { ChevronsUpDown } from "lucide-react";
import * as React from "react";

import { ChampionIcon } from "@/components/icons/champion-icon";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ChampionRecommendation {
  name: string;
  games: number;
}

export interface ChampionRecommendations {
  /** Heading for this group (e.g. "Most Played", "Common Matchups") */
  heading: string;
  champions: ChampionRecommendation[];
}

interface ChampionComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  champions: string[];
  ddragonVersion: string;
  placeholder?: string;
  label?: string;
  className?: string;
  /** Optional grouped recommendations shown above the full list */
  recommendations?: ChampionRecommendations[];
}

export function ChampionCombobox({
  value,
  onValueChange,
  champions,
  ddragonVersion: _ddragonVersion,
  placeholder = "Select champion...",
  label,
  className,
  recommendations,
}: ChampionComboboxProps) {
  const [open, setOpen] = React.useState(false);

  // Collect recommended champion names so we can exclude them from "All Champions"
  const recommendedNames = React.useMemo(() => {
    if (!recommendations) return new Set<string>();
    const names = new Set<string>();
    for (const group of recommendations) {
      for (const c of group.champions) {
        names.add(c.name);
      }
    }
    return names;
  }, [recommendations]);

  const hasRecommendations = recommendations && recommendations.some((g) => g.champions.length > 0);

  return (
    <div className={className}>
      {label && (
        <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-controls="champion-listbox"
              aria-expanded={open}
              aria-label={label || placeholder}
              className="w-full justify-between font-normal"
            />
          }
        >
          {value ? (
            <span className="flex items-center gap-2">
              <ChampionIcon championName={value} size={20} />
              {value}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[--anchor-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search champion..." />
            <CommandList id="champion-listbox">
              <CommandEmpty>No champion found.</CommandEmpty>

              {/* Recommendation groups */}
              {hasRecommendations &&
                recommendations.map(
                  (group) =>
                    group.champions.length > 0 && (
                      <CommandGroup key={group.heading} heading={group.heading}>
                        {group.champions.map((c) => (
                          <CommandItem
                            key={c.name}
                            value={c.name}
                            data-checked={value === c.name}
                            onSelect={(currentValue) => {
                              onValueChange(currentValue === value ? "" : currentValue);
                              setOpen(false);
                            }}
                          >
                            <ChampionIcon championName={c.name} size={20} />
                            {c.name}
                            <span className="ml-auto text-xs text-muted-foreground">
                              {c.games}G
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ),
                )}

              {hasRecommendations && <CommandSeparator />}

              {/* Full alphabetical list (excluding already-shown recommendations) */}
              <CommandGroup heading={hasRecommendations ? "All champions" : undefined}>
                {champions
                  .filter((name) => !hasRecommendations || !recommendedNames.has(name))
                  .map((name) => (
                    <CommandItem
                      key={name}
                      value={name}
                      data-checked={value === name}
                      onSelect={(currentValue) => {
                        onValueChange(currentValue === value ? "" : currentValue);
                        setOpen(false);
                      }}
                    >
                      <ChampionIcon championName={name} size={20} />
                      {name}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

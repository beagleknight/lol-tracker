"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getChampionIconUrl } from "@/lib/riot-api";

interface ChampionComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  champions: string[];
  ddragonVersion: string;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function ChampionCombobox({
  value,
  onValueChange,
  champions,
  ddragonVersion,
  placeholder = "Select champion...",
  label,
  className,
}: ChampionComboboxProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={className}>
      {label && (
        <span className="text-xs font-medium text-muted-foreground mb-1 block">
          {label}
        </span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal"
            />
          }
        >
          {value ? (
            <span className="flex items-center gap-2">
              <Image
                src={getChampionIconUrl(ddragonVersion, value)}
                alt={value}
                width={20}
                height={20}
                className="rounded"
              />
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
            <CommandList>
              <CommandEmpty>No champion found.</CommandEmpty>
              <CommandGroup>
                {champions.map((name) => (
                  <CommandItem
                    key={name}
                    value={name}
                    data-checked={value === name}
                    onSelect={(currentValue) => {
                      onValueChange(currentValue === value ? "" : currentValue);
                      setOpen(false);
                    }}
                  >
                    <Image
                      src={getChampionIconUrl(ddragonVersion, name)}
                      alt={name}
                      width={20}
                      height={20}
                      className="rounded"
                    />
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

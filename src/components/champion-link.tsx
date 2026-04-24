"use client";

import Link from "next/link";

import { ChampionIcon } from "@/components/icons/champion-icon";

interface ChampionLinkProps {
  /** The champion name (DDragon key, e.g. "Qiyana", "MonkeyKing") */
  champion: string;
  /** DDragon version for icon URL */
  ddragonVersion: string;
  /** Where the link should navigate */
  linkTo: "scout-enemy" | "scout-your" | "matches";
  /** Optional: your champion for scout links that include both */
  yourChampion?: string;
  /** Optional: enemy champion for scout links that include both */
  enemyChampion?: string;
  /** Show champion icon (default: true) */
  showIcon?: boolean;
  /** Show champion name text (default: true) */
  showName?: boolean;
  /** Icon size in pixels (default: 16) */
  iconSize?: number;
  /** Additional class names for the link wrapper */
  className?: string;
  /** Additional class names for the text */
  textClassName?: string;
  /** Stop event propagation (useful when inside clickable parents) */
  stopPropagation?: boolean;
}

function buildHref({
  champion,
  linkTo,
  yourChampion,
  enemyChampion,
}: Pick<ChampionLinkProps, "champion" | "linkTo" | "yourChampion" | "enemyChampion">): string {
  switch (linkTo) {
    case "scout-enemy": {
      const params = new URLSearchParams({ enemy: champion });
      if (yourChampion) params.set("your", yourChampion);
      return `/scout?${params.toString()}`;
    }
    case "scout-your": {
      const params = new URLSearchParams({ your: champion });
      if (enemyChampion) params.set("enemy", enemyChampion);
      return `/scout?${params.toString()}`;
    }
    case "matches":
      return `/matches?champion=${encodeURIComponent(champion)}`;
  }
}

export function ChampionLink({
  champion,
  ddragonVersion: _ddragonVersion,
  linkTo,
  yourChampion,
  enemyChampion,
  showIcon = true,
  showName = true,
  iconSize = 16,
  className = "",
  textClassName = "",
  stopPropagation = false,
}: ChampionLinkProps) {
  const href = buildHref({ champion, linkTo, yourChampion, enemyChampion });

  return (
    <Link
      href={href}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      className={`-mx-0.5 inline-flex items-center gap-1 rounded px-0.5 transition-colors hover:bg-accent/50 ${className}`}
      title={`${linkTo === "matches" ? "View games as" : "Scout"} ${champion}`}
    >
      {showIcon && <ChampionIcon championName={champion} size={iconSize} />}
      {showName && <span className={textClassName}>{champion}</span>}
    </Link>
  );
}

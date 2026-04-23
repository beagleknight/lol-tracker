"use client";

import type { LucideIcon } from "lucide-react";

import {
  Ban,
  Calendar,
  CalendarCheck,
  ClipboardCheck,
  Clock,
  Coins,
  Crown,
  EyeOff,
  Flame,
  Ghost,
  GraduationCap,
  Heart,
  HelpCircle,
  Layers,
  Link,
  ListChecks,
  Play,
  Shuffle,
  Skull,
  Sparkles,
  Star,
  Sun,
  Swords,
  Target,
  Timer,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
  ShieldOff,
} from "lucide-react";

import type { AchievementCategory, TierName } from "@/lib/achievements";

import { getTierName } from "@/lib/achievements";
import { cn } from "@/lib/utils";

// ─── Icon Map ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Ban,
  Calendar,
  CalendarCheck,
  ClipboardCheck,
  Clock,
  Coins,
  Crown,
  EyeOff,
  Flame,
  Ghost,
  GraduationCap,
  Heart,
  HelpCircle,
  Layers,
  Link,
  ListChecks,
  Play,
  Shuffle,
  Skull,
  Sparkles,
  Star,
  Sun,
  Swords,
  Target,
  Timer,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
  ShieldOff,
};

// ─── Category Colors & Shapes ────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  AchievementCategory,
  { gradient: string; bgLight: string; borderColor: string }
> = {
  coaching: {
    gradient: "from-blue-500 to-blue-700",
    bgLight: "bg-blue-500/15",
    borderColor: "border-blue-500/40",
  },
  challenges: {
    gradient: "from-orange-500 to-orange-700",
    bgLight: "bg-orange-500/15",
    borderColor: "border-orange-500/40",
  },
  reviews: {
    gradient: "from-purple-500 to-purple-700",
    bgLight: "bg-purple-500/15",
    borderColor: "border-purple-500/40",
  },
  matches: {
    gradient: "from-red-500 to-red-700",
    bgLight: "bg-red-500/15",
    borderColor: "border-red-500/40",
  },
  combat: {
    gradient: "from-rose-500 to-rose-700",
    bgLight: "bg-rose-500/15",
    borderColor: "border-rose-500/40",
  },
  highlights: {
    gradient: "from-yellow-500 to-yellow-700",
    bgLight: "bg-yellow-500/15",
    borderColor: "border-yellow-500/40",
  },
  general: {
    gradient: "from-emerald-500 to-emerald-700",
    bgLight: "bg-emerald-500/15",
    borderColor: "border-emerald-500/40",
  },
};

// ─── Tier Colors ─────────────────────────────────────────────────────────────

const TIER_RING_COLORS: Record<TierName, string> = {
  iron: "ring-zinc-400/60",
  bronze: "ring-amber-700/60",
  silver: "ring-slate-300/60",
  gold: "ring-yellow-400/60",
  platinum: "ring-cyan-400/60",
  diamond: "ring-blue-400/60",
};

const TIER_GLOW_COLORS: Record<TierName, string> = {
  iron: "",
  bronze: "",
  silver: "",
  gold: "shadow-yellow-400/20",
  platinum: "shadow-cyan-400/20",
  diamond: "shadow-blue-400/30",
};

// ─── Badge Component ─────────────────────────────────────────────────────────

export interface AchievementBadgeProps {
  icon: string;
  category: AchievementCategory;
  unlocked: boolean;
  secret: boolean;
  tier?: number | null; // for tiered achievements
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-20 w-20",
};

const ICON_SIZE_CLASSES = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-9 w-9",
};

export function AchievementBadge({
  icon,
  category,
  unlocked,
  secret,
  tier,
  size = "md",
  className,
}: AchievementBadgeProps) {
  const categoryConfig = CATEGORY_CONFIG[category];
  const tierName = tier ? getTierName(tier) : null;

  // Locked (secret or not): show the icon dimmed
  if (!unlocked) {
    const Icon = ICON_MAP[icon] ?? HelpCircle;
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl border-2 border-muted-foreground/20 bg-muted/30 grayscale",
          SIZE_CLASSES[size],
          className,
        )}
      >
        <Icon className={cn("text-muted-foreground/40", ICON_SIZE_CLASSES[size])} />
      </div>
    );
  }

  // Unlocked: full color with category gradient and tier ring
  const Icon = ICON_MAP[icon] ?? HelpCircle;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl border-2 bg-gradient-to-br",
        categoryConfig.gradient,
        tierName && `ring-2 ${TIER_RING_COLORS[tierName]}`,
        tierName && TIER_GLOW_COLORS[tierName] && `shadow-lg ${TIER_GLOW_COLORS[tierName]}`,
        SIZE_CLASSES[size],
        className,
      )}
      style={{ borderColor: "transparent" }}
    >
      <Icon className={cn("text-white drop-shadow-sm", ICON_SIZE_CLASSES[size])} />
    </div>
  );
}

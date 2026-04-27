"use client";

import {
  LayoutDashboard,
  Swords,
  Crosshair,
  BarChart3,
  GraduationCap,
  ClipboardCheck,
  ListChecks,
  Menu,
  X,
  Users,
  RefreshCw,
  Sparkles,
  Target,
  Shield,
  MessageSquarePlus,
  Scale,
  Lock,
  Trophy,
} from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

import { Logo } from "@/components/logo";

const AchievementUnlockModal = dynamic(
  () => import("@/components/achievement-unlock-modal").then((m) => m.AchievementUnlockModal),
  { ssr: false },
);

const ChallengeResultModal = dynamic(
  () => import("@/components/challenge-result-modal").then((m) => m.ChallengeResultModal),
  { ssr: false },
);

import { SeasonFilter } from "@/components/season-filter";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useSyncMatches } from "@/hooks/use-sync-matches";
import { useAuth } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import { UserMenu, type RiotAccountItem } from "./user-menu";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number; // optional counter badge
  dot?: boolean; // small unseen indicator dot
  locked?: boolean; // premium-locked indicator for free users
  external?: boolean; // external link — renders <a> instead of Next.js <Link>
}

/** Nav definitions without labels — labels are resolved via useTranslations */
const navDefs = {
  dashboard: [{ key: "navDashboard" as const, href: "/dashboard", icon: LayoutDashboard }],
  tracker: [
    { key: "navMatches" as const, href: "/matches", icon: Swords },
    { key: "navReview" as const, href: "/review", icon: ClipboardCheck },
    { key: "navDuo" as const, href: "/duo", icon: Users },
    { key: "navChallenges" as const, href: "/challenges", icon: Target },
  ],
  insights: [
    { key: "navAnalytics" as const, href: "/analytics", icon: BarChart3 },
    { key: "navMatchupScout" as const, href: "/scout", icon: Crosshair },
  ],
  coaching: [
    { key: "navSessions" as const, href: "/coaching", icon: GraduationCap },
    { key: "navActionItems" as const, href: "/coaching/action-items", icon: ListChecks },
  ],
  bottom: [
    { key: "navAchievements" as const, href: "/achievements", icon: Trophy },
    { key: "navWhatsNew" as const, href: "/changelog", icon: Sparkles },
    { key: "navFeedback" as const, href: "/feedback", icon: MessageSquarePlus },
    { key: "navLegal" as const, href: "/legal", icon: Scale },
  ],
} as const;

// All nav hrefs — used to resolve active state conflicts between parent/child routes
const allNavHrefs = [
  ...navDefs.dashboard,
  ...navDefs.tracker,
  ...navDefs.insights,
  ...navDefs.coaching,
  ...navDefs.bottom,
].map((item) => item.href);

interface SidebarProps {
  user: {
    name?: string | null;
    image?: string | null;
    riotGameName?: string | null;
    riotTagLine?: string | null;
    isRiotLinked?: boolean;
    role?: string | null;
  };
  reviewCounts?: {
    pending: number;
  };
  latestChangelogVersion?: string | null;
  riotAccounts?: RiotAccountItem[];
  activeRiotAccountId?: string | null;
  seasonFilter?: string;
}

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();

  // Active state: exact match always wins. For startsWith, only activate if no
  // other nav item has a more specific (longer) href that also matches.
  const isExactMatch = !item.external && pathname === item.href;
  const isPrefixMatch = !item.external && pathname.startsWith(item.href + "/");
  const hasMoreSpecificSibling =
    isPrefixMatch &&
    allNavHrefs.some(
      (href) =>
        href !== item.href &&
        href.startsWith(item.href + "/") &&
        (pathname === href || pathname.startsWith(href + "/")),
    );
  const isActive = isExactMatch || (isPrefixMatch && !hasMoreSpecificSibling);
  const Icon = item.icon;

  const className = cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
    isActive
      ? "glow-gold-sm border-l-2 border-gold bg-gold/10 font-medium text-gold"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );

  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.locked && <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
      {item.badge != null && item.badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-gold/20 px-1.5 text-xs font-semibold text-gold">
          {item.badge}
        </span>
      )}
      {item.dot && <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-gold" />}
    </>
  );

  if (item.locked) {
    return (
      <div className={cn(className, "cursor-not-allowed opacity-50")} aria-disabled="true">
        {content}
      </div>
    );
  }

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} prefetch={false} onClick={onClick} className={className}>
      {content}
    </Link>
  );
}

function SidebarContent({
  user,
  reviewCounts,
  latestChangelogVersion,
  riotAccounts,
  activeRiotAccountId,
  seasonFilter,
  onNavClick,
}: SidebarProps & { onNavClick?: () => void }) {
  const t = useTranslations("Sidebar");
  const isLinked = !!user.isRiotLinked;
  const { user: authUser } = useAuth();
  const isDemoUser = authUser?.isDemoUser ?? false;
  const {
    isSyncing,
    handleSync,
    challengeTransitions,
    dismissChallengeTransitions,
    achievementTransitions,
    dismissAchievementTransitions,
  } = useSyncMatches(isDemoUser ? false : isLinked);

  // Track whether there are unseen changelog entries
  const [hasUnseenChangelog, setHasUnseenChangelog] = useState(false);
  useEffect(() => {
    if (!latestChangelogVersion) return;
    const lastSeen = localStorage.getItem("changelog-last-seen");
    setHasUnseenChangelog(lastSeen !== latestChangelogVersion);
  }, [latestChangelogVersion]);

  // Resolve nav labels from translations, remapping hrefs in demo mode
  const resolve = (
    defs: readonly {
      key: string;
      href: string;
      icon: React.ComponentType<{ className?: string }>;
      external?: boolean;
    }[],
  ): NavItem[] =>
    defs.map((d) => ({
      label: t(d.key),
      href: d.href,
      icon: d.icon,
      ...(d.external && { external: true }),
    }));

  const dashboardNav = resolve(navDefs.dashboard);
  const trackerNav = resolve(navDefs.tracker);
  const insightsNav = resolve(navDefs.insights);
  const coachingNav = resolve(navDefs.coaching);
  const bottomNav = resolve(navDefs.bottom);

  // Inject review badge counts and premium lock into the tracker nav
  const totalReview = reviewCounts?.pending ?? 0;
  const isFreeUser = user.role === "free";
  const trackerNavWithBadges = trackerNav.map((item) => {
    let updated = item;
    if (item.href === "/review" && totalReview > 0) {
      updated = { ...updated, badge: totalReview };
    }
    if (item.href === "/duo" && isFreeUser) {
      updated = { ...updated, locked: true };
    }
    return updated;
  });

  // Inject unseen dot into the changelog nav link
  const bottomNavWithDot = bottomNav.map((item) =>
    item.href === "/changelog" && hasUnseenChangelog ? { ...item, dot: true } : item,
  );

  // Conditionally add Admin link for admin users
  const isAdmin = user.role === "admin";
  const adminNav: NavItem[] = isAdmin
    ? [{ label: t("navAdmin"), href: "/admin", icon: Shield }]
    : [];

  return (
    <div className="flex h-full flex-col">
      {/* Logo + Sync */}
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2 font-semibold">
          <Logo className="h-5 w-5 text-gold" />
          <span className="text-gradient-gold">LoL Tracker</span>
        </div>
        {!isDemoUser && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8",
              isLinked
                ? "text-gold/70 ring-1 ring-gold/20 hover:bg-gold/10 hover:text-gold"
                : "text-muted-foreground",
            )}
            onClick={() => handleSync()}
            disabled={isSyncing || !isLinked}
            title={isLinked ? t("updateGamesTooltip") : t("linkRiotAccountTooltip")}
          >
            <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          </Button>
        )}
      </div>
      <Separator />

      {/* Season filter — prominent position below logo */}
      <div className="px-3 pt-2 pb-1">
        <SeasonFilter currentFilter={seasonFilter ?? "all"} />
      </div>
      <Separator />

      {/* Main nav */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {dashboardNav.map((item) => (
            <NavLink key={item.href} item={item} onClick={onNavClick} />
          ))}
        </div>

        <div className="mt-6 mb-2 px-3 text-xs font-semibold tracking-wider text-gold/70 uppercase">
          {t("sectionTracker")}
        </div>
        <div className="space-y-1">
          {trackerNavWithBadges.map((item) => (
            <NavLink key={item.href} item={item} onClick={onNavClick} />
          ))}
        </div>

        <div className="mt-6 mb-2 px-3 text-xs font-semibold tracking-wider text-gold/70 uppercase">
          {t("sectionInsights")}
        </div>
        <div className="space-y-1">
          {insightsNav.map((item) => (
            <NavLink key={item.href} item={item} onClick={onNavClick} />
          ))}
        </div>

        <div className="mt-6 mb-2 px-3 text-xs font-semibold tracking-wider text-gold/70 uppercase">
          {t("sectionCoaching")}
        </div>
        <div className="space-y-1">
          {coachingNav.map((item) => (
            <NavLink key={item.href} item={item} onClick={onNavClick} />
          ))}
        </div>

        <Separator className="my-4" />

        <div className="space-y-1">
          {bottomNavWithDot.map((item) => (
            <NavLink key={item.href} item={item} onClick={onNavClick} />
          ))}
          {adminNav.map((item) => (
            <NavLink key={item.href} item={item} onClick={onNavClick} />
          ))}
        </div>
      </ScrollArea>

      {/* User section */}
      <Separator />
      <div className="p-3">
        <UserMenu
          user={user}
          accounts={riotAccounts ?? []}
          activeAccountId={activeRiotAccountId ?? null}
        />
      </div>

      {/* Challenge result popup — rendered via portal (not for demo users) */}
      {!isDemoUser && challengeTransitions.length > 0 && (
        <ChallengeResultModal
          transitions={challengeTransitions}
          onDismiss={dismissChallengeTransitions}
        />
      )}

      {/* Achievement unlock popup — rendered via portal (not for demo users) */}
      {!isDemoUser && achievementTransitions.length > 0 && (
        <AchievementUnlockModal
          transitions={achievementTransitions}
          onDismiss={dismissAchievementTransitions}
        />
      )}
    </div>
  );
}

export function AppSidebar({
  user,
  reviewCounts,
  latestChangelogVersion,
  riotAccounts,
  activeRiotAccountId,
  seasonFilter,
}: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useTranslations("Sidebar");

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          aria-label={t("closeSidebar")}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-64 border-r border-border/50 bg-card transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent
          user={user}
          reviewCounts={reviewCounts}
          latestChangelogVersion={latestChangelogVersion}
          riotAccounts={riotAccounts}
          activeRiotAccountId={activeRiotAccountId}
          seasonFilter={seasonFilter}
          onNavClick={() => setMobileOpen(false)}
        />
      </aside>
    </>
  );
}

"use client";

import {
  LayoutDashboard,
  Swords,
  Crosshair,
  BarChart3,
  GraduationCap,
  ClipboardCheck,
  Settings,
  ListChecks,
  Menu,
  X,
  Users,
  RefreshCw,
  Sparkles,
  Target,
  Shield,
  MessageSquarePlus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useSyncMatches } from "@/hooks/use-sync-matches";
import { cn } from "@/lib/utils";

import { UserMenu, type RiotAccountItem } from "./user-menu";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number; // optional counter badge
  dot?: boolean; // small unseen indicator dot
}

/** Nav definitions without labels — labels are resolved via useTranslations */
const navDefs = {
  dashboard: [{ key: "navDashboard" as const, href: "/dashboard", icon: LayoutDashboard }],
  tracker: [
    { key: "navMatches" as const, href: "/matches", icon: Swords },
    { key: "navReview" as const, href: "/review", icon: ClipboardCheck },
    { key: "navDuo" as const, href: "/duo", icon: Users },
    { key: "navGoals" as const, href: "/goals", icon: Target },
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
    { key: "navWhatsNew" as const, href: "/changelog", icon: Sparkles },
    { key: "navFeedback" as const, href: "/feedback", icon: MessageSquarePlus },
    { key: "navSettings" as const, href: "/settings", icon: Settings },
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
    postGame: number;
    vod: number;
  };
  latestChangelogVersion?: string | null;
  riotAccounts?: RiotAccountItem[];
  activeRiotAccountId?: string | null;
}

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();

  // Active state: exact match always wins. For startsWith, only activate if no
  // other nav item has a more specific (longer) href that also matches.
  const isExactMatch = pathname === item.href;
  const isPrefixMatch = pathname.startsWith(item.href + "/");
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

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
        isActive
          ? "glow-gold-sm border-l-2 border-gold bg-gold/10 font-medium text-gold"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-gold/20 px-1.5 text-xs font-semibold text-gold">
          {item.badge}
        </span>
      )}
      {item.dot && <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-gold" />}
    </Link>
  );
}

function SidebarContent({
  user,
  reviewCounts,
  latestChangelogVersion,
  riotAccounts,
  activeRiotAccountId,
  onNavClick,
}: SidebarProps & { onNavClick?: () => void }) {
  const t = useTranslations("Sidebar");
  const isLinked = !!user.isRiotLinked;
  const { isSyncing, handleSync } = useSyncMatches(isLinked);

  // Track whether there are unseen changelog entries
  const [hasUnseenChangelog, setHasUnseenChangelog] = useState(false);
  useEffect(() => {
    if (!latestChangelogVersion) return;
    const lastSeen = localStorage.getItem("changelog-last-seen");
    setHasUnseenChangelog(lastSeen !== latestChangelogVersion);
  }, [latestChangelogVersion]);

  // Resolve nav labels from translations
  const resolve = (
    defs: readonly {
      key: string;
      href: string;
      icon: React.ComponentType<{ className?: string }>;
    }[],
  ): NavItem[] => defs.map((d) => ({ label: t(d.key), href: d.href, icon: d.icon }));

  const dashboardNav = resolve(navDefs.dashboard);
  const trackerNav = resolve(navDefs.tracker);
  const insightsNav = resolve(navDefs.insights);
  const coachingNav = resolve(navDefs.coaching);
  const bottomNav = resolve(navDefs.bottom);

  // Inject review badge counts into the tracker nav
  const totalReview = (reviewCounts?.postGame ?? 0) + (reviewCounts?.vod ?? 0);
  const trackerNavWithBadges = trackerNav.map((item) =>
    item.href === "/review" && totalReview > 0 ? { ...item, badge: totalReview } : item,
  );

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
    </div>
  );
}

export function AppSidebar({
  user,
  reviewCounts,
  latestChangelogVersion,
  riotAccounts,
  activeRiotAccountId,
}: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          aria-label="Close sidebar"
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
          onNavClick={() => setMobileOpen(false)}
        />
      </aside>
    </>
  );
}

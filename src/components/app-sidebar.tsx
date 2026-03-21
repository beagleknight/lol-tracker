"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Swords,
  Crosshair,
  BarChart3,
  GraduationCap,
  ClipboardCheck,
  Settings,
  Upload,
  LogOut,
  ListChecks,
  Menu,
  X,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Matches", href: "/matches", icon: Swords },
  { label: "Matchup Scout", href: "/scout", icon: Crosshair },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Duo", href: "/duo", icon: Users },
  { label: "Review Queue", href: "/review", icon: ClipboardCheck },
];

const coachingNav: NavItem[] = [
  { label: "Sessions", href: "/coaching", icon: GraduationCap },
  { label: "Action Items", href: "/coaching/action-items", icon: ListChecks },
];

const bottomNav: NavItem[] = [
  { label: "Merge CSV", href: "/import", icon: Upload },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  user: {
    name?: string | null;
    image?: string | null;
    riotGameName?: string | null;
    riotTagLine?: string | null;
  };
}

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
        isActive
          ? "bg-gold/10 text-gold font-medium border-l-2 border-gold glow-gold-sm"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function SidebarContent({
  user,
  onNavClick,
}: SidebarProps & { onNavClick?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4 font-semibold">
        <Swords className="h-5 w-5 text-gold" />
        <span className="text-gradient-gold">LoL Tracker</span>
      </div>
      <Separator />

      {/* Main nav */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {mainNav.map((item) => (
            <NavLink key={item.href} item={item} onClick={onNavClick} />
          ))}
        </div>

        <div className="mt-6 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gold/50">
          Coaching
        </div>
        <div className="space-y-1">
          {coachingNav.map((item) => (
            <NavLink key={item.href} item={item} onClick={onNavClick} />
          ))}
        </div>

        <Separator className="my-4" />

        <div className="space-y-1">
          {bottomNav.map((item) => (
            <NavLink key={item.href} item={item} onClick={onNavClick} />
          ))}
        </div>
      </ScrollArea>

      {/* User section */}
      <Separator />
      <div className="p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <Avatar className="h-8 w-8 ring-2 ring-gold/20">
            <AvatarImage src={user.image || undefined} />
            <AvatarFallback className="bg-gold/10 text-gold">
              {(user.name || "U").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            {user.riotGameName && (
              <p className="text-xs text-gold/60 truncate">
                {user.riotGameName}#{user.riotTagLine}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 hover:text-destructive"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar({ user }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-64 border-r border-border/50 bg-card transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent
          user={user}
          onNavClick={() => setMobileOpen(false)}
        />
      </aside>
    </>
  );
}

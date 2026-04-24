"use client";

import {
  Check,
  ChevronDown,
  Crown,
  LogOut,
  Moon,
  Monitor,
  Settings,
  Shield,
  Sun,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { switchActiveAccount } from "@/app/actions/riot-accounts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export interface RiotAccountItem {
  id: string;
  puuid: string;
  riotGameName: string;
  riotTagLine: string;
  region: string;
  isPrimary: boolean;
  label: string | null;
}

interface UserMenuProps {
  user: {
    name?: string | null;
    image?: string | null;
    riotGameName?: string | null;
    riotTagLine?: string | null;
    isRiotLinked?: boolean;
    role?: string | null;
  };
  accounts: RiotAccountItem[];
  activeAccountId: string | null;
}

const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function useMounted() {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

export function UserMenu({ user, accounts, activeAccountId }: UserMenuProps) {
  const t = useTranslations("Sidebar");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? accounts[0] ?? null;
  const hasMultipleAccounts = accounts.length > 1;

  function handleSwitch(accountId: string) {
    if (accountId === activeAccountId) return;

    startTransition(async () => {
      const result = await switchActiveAccount(accountId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          t("switchedTo", {
            gameName: result.gameName ?? "",
            tagLine: result.tagLine ?? "",
          }),
        );
        router.refresh();
      }
    });
  }

  const cycleTheme = () => {
    if (theme === "dark") setTheme("light");
    else if (theme === "light") setTheme("system");
    else setTheme("dark");
  };

  const themeIcon = !mounted ? (
    <Moon className="h-4 w-4" />
  ) : theme === "dark" ? (
    <Moon className="h-4 w-4" />
  ) : theme === "light" ? (
    <Sun className="h-4 w-4" />
  ) : (
    <Monitor className="h-4 w-4" />
  );

  const themeLabel = !mounted
    ? "Dark"
    : theme === "dark"
      ? "Dark"
      : theme === "light"
        ? "Light"
        : "System";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
          "hover:bg-accent focus-visible:ring-1 focus-visible:ring-gold/40 focus-visible:outline-none",
          isPending && "pointer-events-none opacity-50",
        )}
        aria-label={t("accountSwitcherLabel")}
      >
        <Avatar className="h-8 w-8 shrink-0 ring-2 ring-gold/20">
          <AvatarImage src={user.image || undefined} alt={user.name ?? ""} />
          <AvatarFallback className="bg-gold/10 text-gold">
            {(user.name || "U").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium">{user.name}</p>
            {user.role === "premium" && (
              <Crown className="h-3.5 w-3.5 shrink-0 text-gold" aria-label={t("premiumBadge")} />
            )}
            {user.role === "admin" && (
              <Shield className="h-3.5 w-3.5 shrink-0 text-gold" aria-label={t("adminBadge")} />
            )}
          </div>
          {activeAccount && (
            <p className="truncate text-xs text-gold/70">
              {activeAccount.riotGameName}
              <span className="text-muted-foreground">#{activeAccount.riotTagLine}</span>
            </p>
          )}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-64">
        {/* Account list (only if multiple accounts) */}
        {hasMultipleAccounts && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("accountSwitcherLabel")}</DropdownMenuLabel>
              {accounts.map((account) => {
                const isActive = account.id === activeAccountId;
                return (
                  <DropdownMenuItem
                    key={account.id}
                    onClick={() => handleSwitch(account.id)}
                    className={cn(isActive && "bg-gold/10")}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {isActive ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-gold" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn("truncate text-sm", isActive && "font-medium text-gold")}
                          >
                            {account.riotGameName}
                            <span className="text-muted-foreground">#{account.riotTagLine}</span>
                          </span>
                          {account.isPrimary && (
                            <Badge
                              variant="default"
                              className="h-4 shrink-0 border border-gold/30 bg-gold/20 px-1 text-[10px] text-gold"
                            >
                              {t("primaryBadge")}
                            </Badge>
                          )}
                        </div>
                        {account.label && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {account.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Settings */}
        <DropdownMenuItem>
          <Link href="/settings" className="flex w-full items-center gap-2">
            <Settings className="h-4 w-4" />
            {t("navSettings")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Theme toggle */}
        <DropdownMenuItem onClick={cycleTheme}>
          {themeIcon}
          <span>{t("theme", { theme: themeLabel })}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuItem
          variant="destructive"
          onClick={() => void logout({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { Check, ChevronDown, Plus, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { switchActiveAccount } from "@/app/actions/riot-accounts";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface AccountSwitcherProps {
  accounts: RiotAccountItem[];
  activeAccountId: string | null;
}

export function AccountSwitcher({ accounts, activeAccountId }: AccountSwitcherProps) {
  const t = useTranslations("Sidebar");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (accounts.length <= 1) {
    return null;
  }

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
          "hover:bg-gold/10 focus-visible:ring-1 focus-visible:ring-gold/40 focus-visible:outline-none",
          isPending && "pointer-events-none opacity-50",
        )}
        aria-label={t("accountSwitcherLabel")}
      >
        <span className="min-w-0 flex-1 truncate text-gold/70">
          {activeAccount.label ?? `${activeAccount.riotGameName}#${activeAccount.riotTagLine}`}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 text-gold/50" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t("accountSwitcherLabel")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

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
                    <span className={cn("truncate text-sm", isActive && "font-medium text-gold")}>
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

        {accounts.length < 5 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link href="/settings?tab=accounts" className="flex w-full items-center gap-2">
                <Plus className="h-3.5 w-3.5" />
                {t("addAccount")}
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link href="/settings?tab=accounts" className="flex w-full items-center gap-2">
            <Settings className="h-3.5 w-3.5" />
            {t("manageAccounts")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

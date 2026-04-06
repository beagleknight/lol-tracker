"use client";

import {
  Unlink,
  Loader2,
  Users,
  Globe,
  Crosshair,
  Search,
  GraduationCap,
  Plus,
  Trash2,
  Star,
  Pencil,
  Check,
  X,
  Eye,
  EyeOff,
  Crown,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

import {
  addRiotAccount,
  removeRiotAccount,
  setAccountAsPrimary,
  updateAccountLabel,
  updateAccountRolePreferences,
  toggleAccountDiscoverable,
  getUserRiotAccounts,
} from "@/app/actions/riot-accounts";
import {
  searchUsers,
  getDuoPartner,
  setDuoPartner,
  clearDuoPartner,
  updateLocale,
  updateLanguage,
  updateCoachingCadence,
} from "@/app/actions/settings";
import { POSITIONS, PositionIcon } from "@/components/position-icon";
import { PremiumGate } from "@/components/premium-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from "@/i18n/languages";
import { useAuth } from "@/lib/auth-client";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, formatDate, type SupportedLocale } from "@/lib/format";
import { PLATFORM_IDS, PLATFORM_LABELS } from "@/lib/riot-api";

const CADENCE_OPTIONS = [
  { days: 7, key: "weekly" as const },
  { days: 14, key: "biweekly" as const },
  { days: 21, key: "threeWeeks" as const },
  { days: 30, key: "monthly" as const },
];

const VALID_TABS = ["account", "preferences", "duo"] as const;

export default function SettingsPage() {
  const { user, updateSession } = useAuth();
  const t = useTranslations("Settings");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Tab from URL param (?tab=accounts)
  const tabParam = searchParams.get("tab");
  const initialTab = VALID_TABS.includes(tabParam as (typeof VALID_TABS)[number])
    ? (tabParam as (typeof VALID_TABS)[number])
    : "account";
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Sync tab from URL when searchParams change
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && VALID_TABS.includes(tab as (typeof VALID_TABS)[number])) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const isLinked = !!user?.riotGameName;
  const userLocale = (user?.locale as SupportedLocale) ?? DEFAULT_LOCALE;
  const userLanguage = (user?.language as SupportedLanguage) ?? DEFAULT_LANGUAGE;
  const userIsPremium = user?.role === "admin" || user?.role === "premium";
  const maxAccounts = userIsPremium ? 5 : 1;

  // Stable date for the locale preview (avoid Next.js prerender `new Date()` error)
  const [previewDate, setPreviewDate] = useState<Date | null>(null);
  useEffect(() => {
    setPreviewDate(new Date());
  }, []);

  // ─── Duo partner state ────────────────────────────────────────────────────
  const [duoPartner, setDuoPartnerState] = useState<{
    id: string;
    name: string | null;
    riotGameName: string | null;
    riotTagLine: string | null;
  } | null>(null);
  const [duoSearchQuery, setDuoSearchQuery] = useState("");
  const [duoSearchResults, setDuoSearchResults] = useState<
    Array<{
      id: string;
      name: string | null;
      riotGameName: string | null;
      riotTagLine: string | null;
    }>
  >([]);
  const [duoSearching, setDuoSearching] = useState(false);
  const duoSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [duoLoading, setDuoLoading] = useState(false);

  // ─── Coaching cadence state ───────────────────────────────────────────────
  const [cadenceDays, setCadenceDays] = useState<number>(user?.coachingCadenceDays ?? 14);

  // ─── Riot accounts state ──────────────────────────────────────────────────
  const [riotAccounts, setRiotAccounts] = useState<
    Array<{
      id: string;
      puuid: string;
      riotGameName: string;
      riotTagLine: string;
      region: string;
      isPrimary: boolean;
      discoverable: boolean;
      label: string | null;
      primaryRole: string | null;
      secondaryRole: string | null;
    }>
  >([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [addAccountRiotId, setAddAccountRiotId] = useState("");
  const [addAccountRegion, setAddAccountRegion] = useState("euw1");
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Load riot accounts on mount and when tab changes to account
  useEffect(() => {
    if (activeTab === "account") {
      setAccountsLoading(true);
      getUserRiotAccounts()
        .then((accts) => setRiotAccounts(accts))
        .catch(() => toast.error(t("toasts.accountAddError")))
        .finally(() => setAccountsLoading(false));
    }
  }, [activeTab, t]);

  // Sync state when session loads (useSession is async)
  useEffect(() => {
    if (user?.coachingCadenceDays) setCadenceDays(user.coachingCadenceDays);
  }, [user?.coachingCadenceDays]);

  // Load duo partner data (for all users)
  useEffect(() => {
    if (isLinked) {
      setDuoLoading(true);
      getDuoPartner()
        .then((partner) => {
          setDuoPartnerState(partner);
        })
        .catch(() => toast.error(t("toasts.loadDuoPartnerError")))
        .finally(() => setDuoLoading(false));
    }
  }, [isLinked, t]);

  // ─── Duo partner handlers ────────────────────────────────────────────────

  function handleSetDuoPartner(partnerUserId: string) {
    startTransition(async () => {
      const result = await setDuoPartner(partnerUserId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          t("toasts.duoPartnerSet", {
            partnerName: result.partnerName ?? "",
          }),
        );
        // Refresh duo partner state and clear search
        const partner = await getDuoPartner();
        setDuoPartnerState(partner);
        setDuoSearchQuery("");
        setDuoSearchResults([]);
      }
    });
  }

  function handleClearDuoPartner() {
    startTransition(async () => {
      const result = await clearDuoPartner();
      if (result.success) {
        toast.success(t("toasts.duoPartnerCleared"));
        setDuoPartnerState(null);
      }
    });
  }

  // ─── Duo partner search ─────────────────────────────────────────────────

  const handleDuoSearch = useCallback(
    (query: string) => {
      setDuoSearchQuery(query);
      setDuoSearchResults([]);

      if (duoSearchTimer.current) {
        clearTimeout(duoSearchTimer.current);
      }

      if (query.trim().length < 2) {
        setDuoSearching(false);
        return;
      }

      setDuoSearching(true);
      duoSearchTimer.current = setTimeout(() => {
        void (async () => {
          try {
            const results = await searchUsers(query);
            setDuoSearchResults(results);
          } catch {
            toast.error(t("toasts.loadDuoPartnerError"));
          } finally {
            setDuoSearching(false);
          }
        })();
      }, 300);
    },
    [t],
  );

  // ─── Locale handler ─────────────────────────────────────────────────────

  function handleLocaleChange(locale: string | null) {
    if (!locale) return;
    startTransition(async () => {
      const result = await updateLocale(locale as SupportedLocale);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("toasts.localeUpdated"));
        await updateSession();
      }
    });
  }

  // ─── Language handler ───────────────────────────────────────────────────

  function handleLanguageChange(language: string | null) {
    if (!language) return;
    startTransition(async () => {
      const result = await updateLanguage(language as SupportedLanguage);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("toasts.languageUpdated"));
        await updateSession();
      }
    });
  }

  // ─── Coaching cadence handler ───────────────────────────────────────────

  function handleCadenceChange(days: number) {
    setCadenceDays(days);
    startTransition(async () => {
      const result = await updateCoachingCadence(days);
      if (result.error) {
        toast.error(t("toasts.cadenceUpdateError"));
      } else {
        toast.success(t("toasts.cadenceUpdated"));
        await updateSession();
      }
    });
  }

  // ─── Riot accounts handlers ─────────────────────────────────────────────

  async function refreshAccounts() {
    try {
      const accts = await getUserRiotAccounts();
      setRiotAccounts(accts);
    } catch {
      // Silently fail — accounts will be stale until next load
    }
  }

  function handleAddAccount() {
    if (!addAccountRiotId.includes("#")) {
      toast.error(t("toasts.riotIdFormatError"));
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("riotId", addAccountRiotId);
      formData.set("region", addAccountRegion);
      const result = await addRiotAccount(formData);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          t("toasts.accountAdded", {
            gameName: result.gameName ?? "",
            tagLine: result.tagLine ?? "",
          }),
        );
        setAddAccountRiotId("");
        await refreshAccounts();
        await updateSession();
      }
    });
  }

  function handleRemoveAccount(accountId: string) {
    startTransition(async () => {
      const result = await removeRiotAccount(accountId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("toasts.accountRemoved"));
        setConfirmRemoveId(null);
        await refreshAccounts();
        await updateSession();
      }
    });
  }

  function handleSetPrimary(accountId: string) {
    startTransition(async () => {
      const result = await setAccountAsPrimary(accountId);
      if (result.error) {
        toast.error(t("toasts.accountSetPrimaryError"));
      } else {
        toast.success(t("toasts.accountSetPrimary"));
        await refreshAccounts();
      }
    });
  }

  function handleSaveLabel(accountId: string) {
    startTransition(async () => {
      const result = await updateAccountLabel(accountId, editingLabelValue || null);
      if (result.error) {
        toast.error(t("toasts.accountLabelError"));
      } else {
        toast.success(t("toasts.accountLabelSaved"));
        setEditingLabelId(null);
        setEditingLabelValue("");
        await refreshAccounts();
      }
    });
  }

  function handleAccountRoleChange(
    accountId: string,
    newPrimary: string | null,
    newSecondary: string | null,
  ) {
    startTransition(async () => {
      const result = await updateAccountRolePreferences(accountId, newPrimary, newSecondary);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("riotAccounts.roleSaved"));
        await refreshAccounts();
        await updateSession();
      }
    });
  }

  function handleTabChange(value: string | number | null) {
    if (typeof value === "string") {
      setActiveTab(value);
      // Update URL without full navigation
      const params = new URLSearchParams(searchParams.toString());
      if (value === "account") {
        params.delete("tab");
      } else {
        params.set("tab", value);
      }
      const qs = params.toString();
      router.replace(`/settings${qs ? `?${qs}` : ""}`, { scroll: false });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList variant="line">
          <TabsTrigger value="account">{t("tabs.account")}</TabsTrigger>
          <TabsTrigger value="preferences">{t("tabs.preferences")}</TabsTrigger>
          <TabsTrigger value="duo">{t("tabs.duo")}</TabsTrigger>
        </TabsList>

        {/* ─── Account Tab ──────────────────────────────────────────── */}
        <TabsContent value="account" className="mt-4">
          <div className="space-y-6">
            {/* ─── Linked Accounts ─────────────────────────────────── */}
            <Card className="surface-glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gold" />
                  {t("riotAccounts.title")}
                </CardTitle>
                <CardDescription>
                  {t("riotAccounts.description")}
                  {riotAccounts.length > 0 && (
                    <span className="ml-2 text-xs text-gold/70">
                      {t("riotAccounts.accountCount", {
                        count: riotAccounts.length,
                        max: maxAccounts,
                      })}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {accountsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 rounded-lg border border-border/30 p-4"
                      >
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-8 w-20" />
                      </div>
                    ))}
                  </div>
                ) : riotAccounts.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {t("riotAccounts.emptyState")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {riotAccounts.map((account) => {
                      const isActive = account.id === user?.activeRiotAccountId;
                      const isEditingLabel = editingLabelId === account.id;
                      const isConfirmingRemove = confirmRemoveId === account.id;

                      return (
                        <div
                          key={account.id}
                          className={`rounded-lg border px-3 py-2.5 transition-colors ${
                            isActive
                              ? "border-gold/30 bg-gold/5"
                              : "border-border/30 bg-surface-elevated"
                          }`}
                        >
                          {/* Top row: name + badges + actions */}
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-foreground">
                                  {account.riotGameName}
                                  <span className="text-muted-foreground">
                                    #{account.riotTagLine}
                                  </span>
                                </span>
                                {account.isPrimary && (
                                  <Badge
                                    variant="default"
                                    className="h-4 shrink-0 border border-gold/30 bg-gold/20 px-1 text-[10px] text-gold"
                                  >
                                    {t("riotAccounts.badgePrimary")}
                                  </Badge>
                                )}
                                {isActive && (
                                  <Badge
                                    variant="default"
                                    className="h-4 shrink-0 border border-emerald-500/30 bg-emerald-500/20 px-1 text-[10px] text-emerald-400"
                                  >
                                    {t("riotAccounts.badgeActive")}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  · {PLATFORM_LABELS[account.region] ?? account.region}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex shrink-0 items-center gap-1">
                              {!account.isPrimary && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-muted-foreground hover:text-gold"
                                  onClick={() => handleSetPrimary(account.id)}
                                  disabled={isPending}
                                  title={t("riotAccounts.setPrimaryButton")}
                                >
                                  <Star className="mr-1 h-3 w-3" />
                                  {t("riotAccounts.setPrimaryButton")}
                                </Button>
                              )}
                              {!account.isPrimary &&
                                (isConfirmingRemove ? (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => handleRemoveAccount(account.id)}
                                      disabled={isPending}
                                    >
                                      {isPending ? (
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                      ) : null}
                                      {t("riotAccounts.removeButton")}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => setConfirmRemoveId(null)}
                                    >
                                      {t("riotAccounts.cancelButton")}
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => setConfirmRemoveId(account.id)}
                                    title={t("riotAccounts.removeButton")}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                ))}
                            </div>
                          </div>

                          {/* Bottom row: label + roles */}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {/* Label */}
                            {isEditingLabel ? (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  value={editingLabelValue}
                                  onChange={(e) => setEditingLabelValue(e.target.value)}
                                  placeholder={t("riotAccounts.labelPlaceholder")}
                                  className="h-6 max-w-[160px] text-xs"
                                  maxLength={30}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveLabel(account.id);
                                    if (e.key === "Escape") {
                                      setEditingLabelId(null);
                                      setEditingLabelValue("");
                                    }
                                  }}
                                  ref={(el) => el?.focus()}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleSaveLabel(account.id)}
                                  disabled={isPending}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    setEditingLabelId(null);
                                    setEditingLabelValue("");
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                aria-label={t("riotAccounts.editLabelButton")}
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEditingLabelId(account.id);
                                  setEditingLabelValue(account.label ?? "");
                                }}
                              >
                                <Pencil className="h-2.5 w-2.5" />
                                {account.label || t("riotAccounts.editLabelButton")}
                              </button>
                            )}

                            {/* Discoverable toggle */}
                            <button
                              type="button"
                              aria-label={t("riotAccounts.discoverableToggle")}
                              title={
                                account.discoverable
                                  ? t("riotAccounts.discoverableOn")
                                  : t("riotAccounts.discoverableOff")
                              }
                              className={`inline-flex items-center gap-1 text-xs transition-colors ${
                                account.discoverable
                                  ? "text-emerald-400 hover:text-emerald-300"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                              disabled={isPending}
                              onClick={() => {
                                startTransition(async () => {
                                  const result = await toggleAccountDiscoverable(
                                    account.id,
                                    !account.discoverable,
                                  );
                                  if (result.error) {
                                    if (result.error === "premiumRequired") {
                                      toast.error(t("riotAccounts.addAccountPremiumRequired"));
                                    } else {
                                      toast.error(result.error);
                                    }
                                  } else {
                                    setRiotAccounts((prev) =>
                                      prev.map((a) =>
                                        a.id === account.id
                                          ? { ...a, discoverable: !a.discoverable }
                                          : a,
                                      ),
                                    );
                                    toast.success(
                                      !account.discoverable
                                        ? t("riotAccounts.discoverableOn")
                                        : t("riotAccounts.discoverableOff"),
                                    );
                                  }
                                });
                              }}
                            >
                              {account.discoverable ? (
                                <Eye className="h-3 w-3" />
                              ) : (
                                <EyeOff className="h-3 w-3" />
                              )}
                              {account.discoverable
                                ? t("riotAccounts.discoverableLabel")
                                : t("riotAccounts.hiddenLabel")}
                            </button>

                            {/* Roles inline */}
                            <div className="flex items-center gap-1.5">
                              <Crosshair className="h-3 w-3 text-muted-foreground" />
                              <Select
                                value={account.primaryRole ?? "none"}
                                onValueChange={(v) => {
                                  if (v === null) return;
                                  const newPrimary = v === "none" ? null : v;
                                  const newSecondary =
                                    newPrimary && newPrimary === account.secondaryRole
                                      ? null
                                      : account.secondaryRole;
                                  handleAccountRoleChange(account.id, newPrimary, newSecondary);
                                }}
                              >
                                <SelectTrigger
                                  className="h-6 w-[110px] text-xs"
                                  disabled={isPending}
                                  aria-label={t("rolePreferences.primaryLabel")}
                                >
                                  <SelectValue placeholder={t("rolePreferences.placeholder")}>
                                    {account.primaryRole ? (
                                      <span className="inline-flex items-center gap-1">
                                        <PositionIcon position={account.primaryRole} size={12} />
                                        {t(`rolePreferences.positions.${account.primaryRole}`)}
                                      </span>
                                    ) : (
                                      t("rolePreferences.placeholder")
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    {t("rolePreferences.nonePlaceholder")}
                                  </SelectItem>
                                  {POSITIONS.map((pos) => (
                                    <SelectItem key={pos} value={pos}>
                                      <span className="flex items-center gap-2">
                                        <PositionIcon position={pos} size={14} />
                                        {t(`rolePreferences.positions.${pos}`)}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={account.secondaryRole ?? "none"}
                                onValueChange={(v) => {
                                  if (v === null) return;
                                  const newSecondary = v === "none" ? null : v;
                                  handleAccountRoleChange(
                                    account.id,
                                    account.primaryRole,
                                    newSecondary,
                                  );
                                }}
                              >
                                <SelectTrigger
                                  className="h-6 w-[110px] text-xs"
                                  disabled={isPending}
                                  aria-label={t("rolePreferences.secondaryLabel")}
                                >
                                  <SelectValue placeholder={t("rolePreferences.nonePlaceholder")}>
                                    {account.secondaryRole ? (
                                      <span className="inline-flex items-center gap-1">
                                        <PositionIcon position={account.secondaryRole} size={12} />
                                        {t(`rolePreferences.positions.${account.secondaryRole}`)}
                                      </span>
                                    ) : (
                                      t("rolePreferences.nonePlaceholder")
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    {t("rolePreferences.nonePlaceholder")}
                                  </SelectItem>
                                  {POSITIONS.filter((pos) => pos !== account.primaryRole).map(
                                    (pos) => (
                                      <SelectItem key={pos} value={pos}>
                                        <span className="flex items-center gap-2">
                                          <PositionIcon position={pos} size={14} />
                                          {t(`rolePreferences.positions.${pos}`)}
                                        </span>
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add Account Card */}
            {!userIsPremium && riotAccounts.length >= 1 ? (
              <Card className="surface-glow">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3 text-center">
                    <Crown className="h-5 w-5 shrink-0 text-gold" />
                    <p className="text-sm text-muted-foreground">
                      {t("riotAccounts.addAccountPremiumRequired")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : riotAccounts.length < maxAccounts ? (
              <Card className="surface-glow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Plus className="h-4 w-4 text-gold" />
                    {t("riotAccounts.addAccountTitle")}
                  </CardTitle>
                  <CardDescription>{t("riotAccounts.addAccountDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="add-account-region" className="text-xs">
                        {t("riotAccounts.regionLabel")}
                      </Label>
                      <Select
                        value={addAccountRegion}
                        onValueChange={(v) => v !== null && setAddAccountRegion(v)}
                      >
                        <SelectTrigger
                          id="add-account-region"
                          className="h-9 w-[160px]"
                          disabled={isPending}
                        >
                          <SelectValue placeholder={t("riotAccounts.regionPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {PLATFORM_IDS.map((id) => (
                            <SelectItem key={id} value={id}>
                              {PLATFORM_LABELS[id]} ({id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label htmlFor="add-account-riot-id" className="text-xs">
                        {t("riotAccounts.riotIdLabel")}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="add-account-riot-id"
                          placeholder={t("riotAccounts.riotIdPlaceholder")}
                          value={addAccountRiotId}
                          onChange={(e) => setAddAccountRiotId(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddAccount();
                          }}
                          disabled={isPending}
                          className="h-9"
                        />
                        <Button
                          onClick={handleAddAccount}
                          disabled={isPending}
                          size="sm"
                          className="h-9"
                        >
                          {isPending ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          {t("riotAccounts.addButton")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="surface-glow">
                <CardContent className="py-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("riotAccounts.accountLimitReached")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ─── Preferences Tab ──────────────────────────────────────── */}
        <TabsContent value="preferences" className="mt-4">
          <div className="space-y-6">
            {/* Language & Region Card */}
            <Card className="surface-glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-gold" />
                  {t("languageCard.title")}
                </CardTitle>
                <CardDescription>{t("languageCard.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="language-select">{t("languageCard.languageLabel")}</Label>
                  <Select value={userLanguage} onValueChange={handleLanguageChange}>
                    <SelectTrigger
                      id="language-select"
                      className="w-full max-w-xs"
                      disabled={isPending}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locale-select">{t("languageCard.formatLabel")}</Label>
                  <Select value={userLocale} onValueChange={handleLocaleChange}>
                    <SelectTrigger
                      id="locale-select"
                      className="w-full max-w-xs"
                      disabled={isPending}
                    >
                      <SelectValue placeholder={t("languageCard.selectPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LOCALES.map((loc) => (
                        <SelectItem key={loc.value} value={loc.value}>
                          {loc.label} ({loc.description})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("languageCard.previewPrefix")}{" "}
                  {previewDate ? formatDate(previewDate, userLocale, "datetime") : "—"}
                </p>
              </CardContent>
            </Card>

            {/* Coaching Cadence Card */}
            <Card className="surface-glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-gold" />
                  {t("coachingCadence.title")}
                </CardTitle>
                <CardDescription>{t("coachingCadence.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {CADENCE_OPTIONS.map((option) => (
                    <Button
                      key={option.days}
                      variant={cadenceDays === option.days ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleCadenceChange(option.days)}
                      disabled={isPending}
                      className={
                        cadenceDays === option.days
                          ? "border-gold/30 bg-gold/20 text-gold hover:bg-gold/30"
                          : ""
                      }
                    >
                      {t(`coachingCadence.${option.key}`)}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("coachingCadence.currentLabel", {
                    days: cadenceDays,
                  })}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Duo Tab ──────────────────────────────────────────────── */}
        <TabsContent value="duo" className="mt-4">
          {!userIsPremium ? (
            <PremiumGate />
          ) : (
            <div className="space-y-6">
              {isLinked ? (
                <Card className="surface-glow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-gold" />
                      {t("duoPartner.title")}
                      {duoPartner ? (
                        <Badge
                          variant="default"
                          className="ml-2 border border-gold/30 bg-gold/20 text-gold"
                        >
                          {t("duoPartner.badgeSet")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="ml-2">
                          {t("duoPartner.badgeNotSet")}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{t("duoPartner.description")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {duoLoading ? (
                      <div className="flex items-center gap-4 rounded-lg border border-border/30 p-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-5 w-40" />
                        </div>
                      </div>
                    ) : duoPartner ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 rounded-lg border border-gold/20 bg-surface-elevated p-4">
                          <div className="flex-1">
                            <p className="text-sm text-muted-foreground">
                              {t("duoPartner.partnerLabel")}
                            </p>
                            <p className="text-lg font-semibold text-gold">
                              {duoPartner.riotGameName}#{duoPartner.riotTagLine}
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleClearDuoPartner}
                            disabled={isPending}
                          >
                            {isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Unlink className="mr-2 h-4 w-4" />
                            )}
                            {t("duoPartner.clearButton")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder={t("duoPartner.searchPlaceholder")}
                            value={duoSearchQuery}
                            onChange={(e) => handleDuoSearch(e.target.value)}
                            className="pl-9"
                            aria-label={t("duoPartner.searchPlaceholder")}
                          />
                        </div>
                        {duoSearchQuery.trim().length < 2 && (
                          <p className="text-sm text-muted-foreground">
                            {t("duoPartner.searchHint")}
                          </p>
                        )}
                        {duoSearching && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t("duoPartner.searching")}
                          </div>
                        )}
                        {!duoSearching &&
                          duoSearchQuery.trim().length >= 2 &&
                          duoSearchResults.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              {t("duoPartner.noResults", {
                                query: duoSearchQuery.trim(),
                              })}
                            </p>
                          )}
                        {duoSearchResults.length > 0 && (
                          <div className="space-y-2">
                            {duoSearchResults.map((u) => (
                              <div
                                key={u.id}
                                className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-elevated p-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gold">
                                    {u.riotGameName}#{u.riotTagLine}
                                  </p>
                                  {u.name && (
                                    <p className="text-xs text-muted-foreground">{u.name}</p>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleSetDuoPartner(u.id)}
                                  disabled={isPending}
                                >
                                  {isPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Users className="mr-2 h-4 w-4" />
                                  )}
                                  {t("duoPartner.setButton")}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="surface-glow">
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">{t("duoPartner.noUsersFound")}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

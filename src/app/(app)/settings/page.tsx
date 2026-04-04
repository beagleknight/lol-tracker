"use client";

import {
  LinkIcon,
  Unlink,
  Loader2,
  Users,
  Globe,
  Crosshair,
  Search,
  GraduationCap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

import {
  linkRiotAccount,
  unlinkRiotAccount,
  updateRegion,
  searchUsers,
  getDuoPartner,
  setDuoPartner,
  clearDuoPartner,
  updateLocale,
  updateLanguage,
  updateRolePreferences,
  updateCoachingCadence,
} from "@/app/actions/settings";
import { POSITIONS, PositionIcon } from "@/components/position-icon";
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

export default function SettingsPage() {
  const { user, updateSession } = useAuth();
  const t = useTranslations("Settings");
  const [riotId, setRiotId] = useState("");
  const [selectedRegion, setSelectedRegion] = useState(user?.region ?? "euw1");
  const [isPending, startTransition] = useTransition();

  const isLinked = !!user?.riotGameName;
  const userLocale = (user?.locale as SupportedLocale) ?? DEFAULT_LOCALE;
  const userLanguage = (user?.language as SupportedLanguage) ?? DEFAULT_LANGUAGE;

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

  // ─── Role preferences state ───────────────────────────────────────────────
  const [primaryRole, setPrimaryRole] = useState<string>(user?.primaryRole ?? "");
  const [secondaryRole, setSecondaryRole] = useState<string>(user?.secondaryRole ?? "");

  // ─── Coaching cadence state ───────────────────────────────────────────────
  const [cadenceDays, setCadenceDays] = useState<number>(user?.coachingCadenceDays ?? 14);

  // Sync state when session loads (useSession is async)
  useEffect(() => {
    if (user?.primaryRole) setPrimaryRole(user.primaryRole);
    if (user?.secondaryRole) setSecondaryRole(user.secondaryRole);
    if (user?.region) setSelectedRegion(user.region);
    if (user?.coachingCadenceDays) setCadenceDays(user.coachingCadenceDays);
  }, [user?.primaryRole, user?.secondaryRole, user?.region, user?.coachingCadenceDays]);

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

  // ─── Riot account handlers ────────────────────────────────────────────────

  function handleLink() {
    if (!riotId.includes("#")) {
      toast.error(t("toasts.riotIdFormatError"));
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("riotId", riotId);
      formData.set("region", selectedRegion);
      const result = await linkRiotAccount(formData);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          t("toasts.linkSuccess", {
            gameName: result.gameName ?? "",
            tagLine: result.tagLine ?? "",
          }),
        );
        setRiotId("");
        await updateSession();
      }
    });
  }

  function handleUnlink() {
    startTransition(async () => {
      try {
        const result = await unlinkRiotAccount();
        if (result.success) {
          toast.success(t("toasts.unlinkSuccess"));
          await updateSession();
        } else {
          toast.error(t("toasts.unlinkError"));
        }
      } catch {
        toast.error(t("toasts.unlinkError"));
      }
    });
  }

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

  function handleRegionChange(region: string | null) {
    if (!region) return;
    setSelectedRegion(region);
    startTransition(async () => {
      const result = await updateRegion(region);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("toasts.regionUpdated"));
        await updateSession();
      }
    });
  }

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

  // ─── Role preferences handler ─────────────────────────────────────────────

  function handleSaveRolePreferences() {
    if (primaryRole && secondaryRole && primaryRole === secondaryRole) {
      toast.error(t("rolePreferences.sameRoleError"));
      return;
    }
    startTransition(async () => {
      const result = await updateRolePreferences(primaryRole || null, secondaryRole || null);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("toasts.rolePreferencesSaved"));
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">{t("tabs.account")}</TabsTrigger>
          <TabsTrigger value="preferences">{t("tabs.preferences")}</TabsTrigger>
          <TabsTrigger value="duo">{t("tabs.duo")}</TabsTrigger>
        </TabsList>

        {/* ─── Account Tab ──────────────────────────────────────────── */}
        <TabsContent value="account">
          <div className="space-y-6">
            {/* Riot Account Card */}
            <Card className="surface-glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {t("riotAccount.title")}
                  {isLinked ? (
                    <Badge
                      variant="default"
                      className="ml-2 border border-gold/30 bg-gold/20 text-gold"
                    >
                      {t("riotAccount.badgeLinked")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-2">
                      {t("riotAccount.badgeNotLinked")}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{t("riotAccount.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLinked ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 rounded-lg border border-gold/20 bg-surface-elevated p-4">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">
                          {t("riotAccount.riotIdLabel")}
                        </p>
                        <p className="text-lg font-semibold text-gold">
                          {user?.riotGameName}#{user?.riotTagLine}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleUnlink}
                        disabled={isPending}
                      >
                        {isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Unlink className="mr-2 h-4 w-4" />
                        )}
                        {t("riotAccount.unlinkButton")}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="region-select">{t("riotAccount.regionLabel")}</Label>
                      <Select value={selectedRegion} onValueChange={handleRegionChange}>
                        <SelectTrigger
                          id="region-select"
                          className="w-full max-w-xs"
                          disabled={isPending}
                        >
                          <SelectValue placeholder={t("riotAccount.regionPlaceholder")} />
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
                    <div className="border-t border-border/30 pt-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                        <Crosshair className="h-4 w-4 text-gold" />
                        {t("rolePreferences.title")}
                      </h3>
                      <p className="mb-3 text-xs text-muted-foreground">
                        {t("rolePreferences.description")}
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="primary-role">{t("rolePreferences.primaryLabel")}</Label>
                          <Select
                            value={primaryRole}
                            onValueChange={(v) => v !== null && setPrimaryRole(v)}
                          >
                            <SelectTrigger
                              id="primary-role"
                              className="w-full"
                              disabled={isPending}
                            >
                              <SelectValue placeholder={t("rolePreferences.placeholder")}>
                                {primaryRole && (
                                  <span className="inline-flex items-center gap-2">
                                    <PositionIcon position={primaryRole} size={14} />
                                    {t(`rolePreferences.positions.${primaryRole}`)}
                                  </span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {POSITIONS.map((pos) => (
                                <SelectItem key={pos} value={pos}>
                                  <span className="inline-flex items-center gap-2">
                                    <PositionIcon position={pos} size={14} />
                                    {t(`rolePreferences.positions.${pos}`)}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="secondary-role">
                            {t("rolePreferences.secondaryLabel")}
                          </Label>
                          <Select
                            value={secondaryRole}
                            onValueChange={(v) => v !== null && setSecondaryRole(v)}
                          >
                            <SelectTrigger
                              id="secondary-role"
                              className="w-full"
                              disabled={isPending}
                            >
                              <SelectValue placeholder={t("rolePreferences.nonePlaceholder")}>
                                {secondaryRole && (
                                  <span className="inline-flex items-center gap-2">
                                    <PositionIcon position={secondaryRole} size={14} />
                                    {t(`rolePreferences.positions.${secondaryRole}`)}
                                  </span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {POSITIONS.filter((pos) => pos !== primaryRole).map((pos) => (
                                <SelectItem key={pos} value={pos}>
                                  <span className="inline-flex items-center gap-2">
                                    <PositionIcon position={pos} size={14} />
                                    {t(`rolePreferences.positions.${pos}`)}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="mt-3"
                        onClick={handleSaveRolePreferences}
                        disabled={isPending}
                      >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {t("rolePreferences.saveButton")}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("riotAccount.unlinkHelpText")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="region-select">{t("riotAccount.regionLabel")}</Label>
                      <Select
                        value={selectedRegion}
                        onValueChange={(v) => v !== null && setSelectedRegion(v)}
                      >
                        <SelectTrigger
                          id="region-select"
                          className="w-full max-w-xs"
                          disabled={isPending}
                        >
                          <SelectValue placeholder={t("riotAccount.regionPlaceholder")} />
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
                    <div className="space-y-2">
                      <Label htmlFor="riot-id">{t("riotAccount.riotIdLabel")}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="riot-id"
                          placeholder={t("riotAccount.riotIdPlaceholder")}
                          value={riotId}
                          onChange={(e) => setRiotId(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleLink();
                          }}
                          disabled={isPending}
                        />
                        <Button onClick={handleLink} disabled={isPending}>
                          {isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <LinkIcon className="mr-2 h-4 w-4" />
                          )}
                          {t("riotAccount.linkButton")}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("riotAccount.linkHelpText")}</p>
                  </div>
                )}
              </CardContent>
            </Card>

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
          </div>
        </TabsContent>

        {/* ─── Preferences Tab ──────────────────────────────────────── */}
        <TabsContent value="preferences">
          <div className="space-y-6">
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
        <TabsContent value="duo">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

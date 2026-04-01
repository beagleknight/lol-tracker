"use client";

import {
  LinkIcon,
  Unlink,
  Loader2,
  Plus,
  Copy,
  Trash2,
  Ticket,
  Shield,
  Users,
  Globe,
  Crosshair,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";

import { createInvite, getInvites, deleteInvite } from "@/app/actions/invites";
import {
  linkRiotAccount,
  unlinkRiotAccount,
  updateRegion,
  getRegisteredUsers,
  getDuoPartner,
  setDuoPartner,
  clearDuoPartner,
  updateLocale,
  updateLanguage,
  updateRolePreferences,
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
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from "@/i18n/languages";
import { useAuth } from "@/lib/auth-client";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, formatDate, type SupportedLocale } from "@/lib/format";
import { PLATFORM_IDS, PLATFORM_LABELS } from "@/lib/riot-api";

interface InviteItem {
  id: number;
  code: string;
  createdAt: Date;
  usedBy: string | null;
  usedByName: string | null;
  usedAt: Date | null;
}

export default function SettingsPage() {
  const { user, updateSession } = useAuth();
  const t = useTranslations("Settings");
  const [riotId, setRiotId] = useState("");
  const [selectedRegion, setSelectedRegion] = useState(user?.region ?? "euw1");
  const [isPending, startTransition] = useTransition();

  const isLinked = !!user?.riotGameName;
  const isAdmin = user?.role === "admin";
  const userLocale = (user?.locale as SupportedLocale) ?? DEFAULT_LOCALE;
  const userLanguage = (user?.language as SupportedLanguage) ?? DEFAULT_LANGUAGE;

  // Stable date for the locale preview (avoid Next.js prerender `new Date()` error)
  const [previewDate, setPreviewDate] = useState<Date | null>(null);
  useEffect(() => {
    setPreviewDate(new Date());
  }, []);

  // ─── Invite state (admin only) ────────────────────────────────────────────
  const [invitesList, setInvitesList] = useState<InviteItem[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  // ─── Duo partner state ────────────────────────────────────────────────────
  const [duoPartner, setDuoPartnerState] = useState<{
    id: string;
    name: string | null;
    riotGameName: string | null;
    riotTagLine: string | null;
  } | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<
    Array<{
      id: string;
      name: string | null;
      riotGameName: string | null;
      riotTagLine: string | null;
      puuid: string | null;
    }>
  >([]);
  const [duoLoading, setDuoLoading] = useState(false);

  // ─── Role preferences state ───────────────────────────────────────────────
  const [primaryRole, setPrimaryRole] = useState<string>(user?.primaryRole ?? "");
  const [secondaryRole, setSecondaryRole] = useState<string>(user?.secondaryRole ?? "");

  // Sync role state when session loads (useSession is async, so initial
  // useState value is "" on first render)
  useEffect(() => {
    if (user?.primaryRole) setPrimaryRole(user.primaryRole);
    if (user?.secondaryRole) setSecondaryRole(user.secondaryRole);
    if (user?.region) setSelectedRegion(user.region);
  }, [user?.primaryRole, user?.secondaryRole, user?.region]);

  useEffect(() => {
    if (isAdmin) {
      // Load invites
      setInvitesLoading(true);
      getInvites()
        .then(setInvitesList)
        .catch(() => toast.error(t("toasts.loadInvitesError")))
        .finally(() => setInvitesLoading(false));
    }
  }, [isAdmin, t]);

  // Load duo partner data (for all users)
  useEffect(() => {
    if (isLinked) {
      setDuoLoading(true);
      Promise.all([getDuoPartner(), getRegisteredUsers()])
        .then(([partner, users]) => {
          setDuoPartnerState(partner);
          setRegisteredUsers(users);
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

  // ─── Invite handlers (admin only) ────────────────────────────────────────

  function handleGenerateInvite() {
    startTransition(async () => {
      try {
        const result = await createInvite();
        toast.success(t("toasts.inviteCreated", { code: result.code }));
        // Refresh invites list
        const updated = await getInvites();
        setInvitesList(updated);
      } catch {
        toast.error(t("toasts.inviteCreateError"));
      }
    });
  }

  function handleCopyCode(code: string) {
    void navigator.clipboard.writeText(code);
    toast.success(t("toasts.inviteCopied"));
  }

  function handleDeleteInvite(id: number) {
    if (!confirm(t("toasts.deleteConfirm"))) return;
    startTransition(async () => {
      try {
        await deleteInvite(id);
        setInvitesList((prev) => prev.filter((inv) => inv.id !== id));
        toast.success(t("toasts.inviteDeleted"));
      } catch {
        toast.error(t("toasts.inviteDeleteError"));
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
        toast.success(t("toasts.duoPartnerSet", { partnerName: result.partnerName ?? "" }));
        // Refresh duo partner state
        const partner = await getDuoPartner();
        setDuoPartnerState(partner);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {/* Riot Account Card */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("riotAccount.title")}
            {isLinked ? (
              <Badge variant="default" className="ml-2 border border-gold/30 bg-gold/20 text-gold">
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
                  <p className="text-sm text-muted-foreground">{t("riotAccount.riotIdLabel")}</p>
                  <p className="text-lg font-semibold text-gold">
                    {user?.riotGameName}#{user?.riotTagLine}
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={handleUnlink} disabled={isPending}>
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
              <p className="text-xs text-muted-foreground">{t("riotAccount.unlinkHelpText")}</p>
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
              <SelectTrigger id="language-select" className="w-full max-w-xs" disabled={isPending}>
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
              <SelectTrigger id="locale-select" className="w-full max-w-xs" disabled={isPending}>
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

      {/* Duo Partner Card */}
      {isLinked && (
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
                    <p className="text-sm text-muted-foreground">{t("duoPartner.partnerLabel")}</p>
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
            ) : registeredUsers.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{t("duoPartner.selectPrompt")}</p>
                <div className="space-y-2">
                  {registeredUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-elevated p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gold">
                          {u.riotGameName}#{u.riotTagLine}
                        </p>
                        {u.name && <p className="text-xs text-muted-foreground">{u.name}</p>}
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
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("duoPartner.noUsersFound")}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Role Preferences Card */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-gold" />
            {t("rolePreferences.title")}
          </CardTitle>
          <CardDescription>{t("rolePreferences.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primary-role">{t("rolePreferences.primaryLabel")}</Label>
              <Select value={primaryRole} onValueChange={(v) => v !== null && setPrimaryRole(v)}>
                <SelectTrigger id="primary-role" className="w-full" disabled={isPending}>
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
              <Label htmlFor="secondary-role">{t("rolePreferences.secondaryLabel")}</Label>
              <Select
                value={secondaryRole}
                onValueChange={(v) => v !== null && setSecondaryRole(v)}
              >
                <SelectTrigger id="secondary-role" className="w-full" disabled={isPending}>
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
          <Button size="sm" onClick={handleSaveRolePreferences} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("rolePreferences.saveButton")}
          </Button>
        </CardContent>
      </Card>

      {/* Admin Section: Invite Friends */}
      {isAdmin && (
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-gold" />
              {t("invites.title")}
              <Badge variant="secondary" className="ml-2">
                <Shield className="mr-1 h-3 w-3" />
                {t("invites.badgeAdmin")}
              </Badge>
            </CardTitle>
            <CardDescription>{t("invites.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleGenerateInvite} disabled={isPending} size="sm">
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {t("invites.generateButton")}
            </Button>

            {invitesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-border/30 p-3"
                  >
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16 flex-1" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                ))}
              </div>
            ) : invitesList.length > 0 ? (
              <div className="space-y-2">
                {invitesList.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-elevated p-3"
                  >
                    <code className="font-mono text-sm font-semibold text-gold">{invite.code}</code>
                    <div className="min-w-0 flex-1">
                      {invite.usedBy ? (
                        <span className="text-xs text-muted-foreground">
                          {t("invites.usedBy", {
                            usedByName: invite.usedByName || t("invites.usedByUnknown"),
                          })}
                        </span>
                      ) : (
                        <Badge variant="outline" className="border-gold/30 text-xs text-gold">
                          {t("invites.badgeAvailable")}
                        </Badge>
                      )}
                    </div>
                    {!invite.usedBy && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyCode(invite.code)}
                        className="h-8 w-8 p-0"
                        aria-label={t("invites.copyCode")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteInvite(invite.id)}
                      disabled={isPending}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      aria-label={t("invites.deleteInvite")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("invites.emptyState")}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

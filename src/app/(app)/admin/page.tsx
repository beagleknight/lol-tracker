"use client";

import {
  Copy,
  Crown,
  Eye,
  Loader2,
  Plus,
  Shield,
  Trash2,
  Ticket,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useState, useTransition, useEffect, useCallback } from "react";
import { toast } from "sonner";

import {
  getUsers,
  deactivateUser,
  reactivateUser,
  updateUserRole,
  startImpersonation,
  type AdminUser,
} from "@/app/actions/admin";
import { createInvite, getInvites, deleteInvite } from "@/app/actions/invites";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-client";
import { formatDate } from "@/lib/format";
import { PLATFORM_LABELS } from "@/lib/riot-api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface InviteItem {
  id: number;
  code: string;
  createdAt: Date;
  usedBy: string | null;
  usedByName: string | null;
  usedAt: Date | null;
  expiresAt: Date | null;
}

// ─── Users Section ──────────────────────────────────────────────────────────

function UsersSection() {
  const t = useTranslations("Admin");
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const locale = currentUser?.locale ?? "en-GB";

  const loadUsers = useCallback(async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function handleDeactivate(userId: string) {
    startTransition(async () => {
      try {
        await deactivateUser(userId);
        toast.success(t("toasts.deactivateSuccess"));
        await loadUsers();
      } catch {
        toast.error(t("toasts.deactivateError"));
      }
    });
  }

  function handleReactivate(userId: string) {
    startTransition(async () => {
      try {
        await reactivateUser(userId);
        toast.success(t("toasts.reactivateSuccess"));
        await loadUsers();
      } catch {
        toast.error(t("toasts.reactivateError"));
      }
    });
  }

  function handleToggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === "premium" ? "free" : "premium";
    startTransition(async () => {
      try {
        await updateUserRole(userId, newRole);
        toast.success(
          newRole === "premium"
            ? t("toasts.grantPremiumSuccess")
            : t("toasts.revokePremiumSuccess"),
        );
        await loadUsers();
      } catch {
        toast.error(t("toasts.roleChangeError"));
      }
    });
  }

  function handleImpersonate(userId: string) {
    startTransition(async () => {
      try {
        await startImpersonation(userId);
      } catch (err) {
        // redirect() throws a NEXT_REDIRECT error — let it propagate so the
        // redirect actually happens instead of showing a false error toast.
        if (isRedirectError(err)) throw err;
        toast.error(err instanceof Error ? err.message : t("toasts.impersonateError"));
      }
    });
  }

  return (
    <Card className="surface-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-gold" />
          {t("usersHeading")}
        </CardTitle>
        <CardDescription>{t("usersDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-border/30 p-3"
              >
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-24 flex-1" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const isYou = u.id === currentUser?.id;
              const isDeactivated = !!u.deactivatedAt;
              return (
                <div
                  key={u.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
                    isDeactivated
                      ? "border-destructive/20 bg-destructive/5 opacity-70"
                      : "border-border/50 bg-surface-elevated"
                  }`}
                >
                  {/* Avatar + Name */}
                  <Avatar className="h-8 w-8 shrink-0 ring-2 ring-gold/20">
                    <AvatarImage src={u.image || undefined} />
                    <AvatarFallback className="bg-gold/10 text-xs text-gold">
                      {(u.name || "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">
                        {u.name || "Unknown"}
                      </span>
                      {u.role === "admin" && (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-gold/30 text-xs text-gold"
                        >
                          <Shield className="mr-1 h-3 w-3" />
                          {t("roleAdmin")}
                        </Badge>
                      )}
                      {u.role === "premium" && (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-blue-400/30 text-xs text-blue-400"
                        >
                          <Crown className="mr-1 h-3 w-3" />
                          {t("rolePremium")}
                        </Badge>
                      )}
                      {u.role === "free" && (
                        <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
                          {t("roleFree")}
                        </Badge>
                      )}
                      {isYou && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {t("youBadge")}
                        </Badge>
                      )}
                      {isDeactivated && (
                        <Badge variant="destructive" className="shrink-0 text-xs">
                          {t("statusDeactivated")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>
                        {u.riotGameName ? `${u.riotGameName}#${u.riotTagLine}` : t("noRiotId")}
                      </span>
                      <span>
                        {u.region ? PLATFORM_LABELS[u.region] || u.region : t("noRegion")}
                      </span>
                      <span>
                        {u.scopedMatchCount !== u.matchCount ? (
                          <span
                            className="text-amber-400"
                            title={t("matchCountMismatchTooltip", {
                              scoped: u.scopedMatchCount,
                              total: u.matchCount,
                            })}
                          >
                            {u.scopedMatchCount}/{u.matchCount} {t("columnMatches").toLowerCase()}
                          </span>
                        ) : (
                          <>
                            {u.matchCount} {t("columnMatches").toLowerCase()}
                          </>
                        )}
                      </span>
                      <span>
                        {t("columnJoined")}: {formatDate(u.createdAt, locale)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {!isYou && (
                    <div className="flex shrink-0 gap-1.5">
                      {u.role !== "admin" && !isDeactivated && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleImpersonate(u.id)}
                          disabled={isPending}
                          className="gap-1.5 text-amber-400 hover:bg-amber-400/10"
                          aria-label={t("impersonateButton", { name: u.name || "Unknown" })}
                        >
                          {isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                          {t("viewAsButton")}
                        </Button>
                      )}
                      {u.role !== "admin" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleRole(u.id, u.role)}
                          disabled={isPending}
                          className={`gap-1.5 ${
                            u.role === "premium"
                              ? "text-muted-foreground hover:bg-muted/50"
                              : "text-blue-400 hover:bg-blue-400/10"
                          }`}
                        >
                          {isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Crown className="h-3.5 w-3.5" />
                          )}
                          {u.role === "premium"
                            ? t("revokePremiumButton")
                            : t("grantPremiumButton")}
                        </Button>
                      )}
                      {isDeactivated ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReactivate(u.id)}
                          disabled={isPending}
                          className="gap-1.5"
                        >
                          {isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5" />
                          )}
                          {t("reactivateButton")}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeactivate(u.id)}
                          disabled={isPending}
                          className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          {isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserX className="h-3.5 w-3.5" />
                          )}
                          {t("deactivateButton")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Invites Section ────────────────────────────────────────────────────────

function InvitesSection() {
  const t = useTranslations("Admin");
  const { user: currentUser } = useAuth();
  const [invitesList, setInvitesList] = useState<InviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const locale = currentUser?.locale ?? "en-GB";

  const loadInvites = useCallback(async () => {
    try {
      const data = await getInvites();
      setInvitesList(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  function getInviteStatus(invite: InviteItem): "available" | "used" | "expired" {
    if (invite.usedBy) return "used";
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return "expired";
    return "available";
  }

  function handleGenerate() {
    startTransition(async () => {
      try {
        await createInvite();
        toast.success(t("toasts.generateSuccess"));
        await loadInvites();
      } catch {
        toast.error(t("toasts.generateError"));
      }
    });
  }

  function handleCopyCode(code: string) {
    const url = `${window.location.origin}/login?invite=${encodeURIComponent(code)}`;
    void navigator.clipboard.writeText(url);
    toast.success(t("toasts.linkCopied"));
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      try {
        await deleteInvite(id);
        toast.success(t("toasts.deleteSuccess"));
        await loadInvites();
      } catch {
        toast.error(t("toasts.deleteError"));
      }
    });
  }

  return (
    <Card className="surface-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-gold" />
          {t("invitesHeading")}
        </CardTitle>
        <CardDescription>{t("invitesDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleGenerate} disabled={isPending} size="sm">
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {t("generateButton")}
        </Button>

        {loading ? (
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
            {invitesList.map((invite) => {
              const status = getInviteStatus(invite);
              return (
                <div
                  key={invite.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    status === "expired"
                      ? "border-border/30 opacity-60"
                      : "border-border/50 bg-surface-elevated"
                  }`}
                >
                  <code className="shrink-0 font-mono text-sm font-semibold text-gold">
                    {invite.code}
                  </code>
                  <div className="min-w-0 flex-1">
                    {status === "used" ? (
                      <span className="text-xs text-muted-foreground">
                        {t("inviteUsedBy", {
                          name: invite.usedByName || t("inviteUsedByUnknown"),
                        })}
                      </span>
                    ) : status === "expired" ? (
                      <Badge
                        variant="outline"
                        className="border-destructive/30 text-xs text-destructive"
                      >
                        {t("inviteStatusExpired")}
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-gold/30 text-xs text-gold">
                          {t("inviteStatusAvailable")}
                        </Badge>
                        {invite.expiresAt && (
                          <span className="text-xs text-muted-foreground">
                            {t("inviteExpiresAt", {
                              date: formatDate(invite.expiresAt, locale),
                            })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {status === "available" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyCode(invite.code)}
                      className="h-8 w-8 p-0"
                      aria-label={t("copyCode")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(invite.id)}
                    disabled={isPending}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    aria-label={t("deleteInvite")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noInvites")}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const t = useTranslations("Admin");
  const { user } = useAuth();

  // Client-side guard — server-side guard is in the server actions
  if (user && user.role !== "admin") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Unauthorized</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gradient-gold text-3xl font-bold tracking-tight">{t("heading")}</h1>
      </div>
      <UsersSection />
      <InvitesSection />
    </div>
  );
}

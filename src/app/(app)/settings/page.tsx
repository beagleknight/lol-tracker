"use client";

import { useState, useTransition, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  linkRiotAccount,
  unlinkRiotAccount,
  getRegisteredUsers,
  getDuoPartner,
  setDuoPartner,
  clearDuoPartner,
} from "@/app/actions/settings";
import {
  createInvite,
  getInvites,
  deleteInvite,
} from "@/app/actions/invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
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
} from "lucide-react";

interface InviteItem {
  id: number;
  code: string;
  createdAt: Date;
  usedBy: string | null;
  usedByName: string | null;
  usedAt: Date | null;
}

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [riotId, setRiotId] = useState("");
  const [isPending, startTransition] = useTransition();

  const isLinked = !!session?.user?.riotGameName;
  const isAdmin = session?.user?.role === "admin";

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

  useEffect(() => {
    if (isAdmin) {
      // Load invites
      setInvitesLoading(true);
      getInvites()
        .then(setInvitesList)
        .catch(() => toast.error("Couldn't load invite codes."))
        .finally(() => setInvitesLoading(false));
    }
  }, [isAdmin]);

  // Load duo partner data (for all users)
  useEffect(() => {
    if (isLinked) {
      setDuoLoading(true);
      Promise.all([getDuoPartner(), getRegisteredUsers()])
        .then(([partner, users]) => {
          setDuoPartnerState(partner);
          setRegisteredUsers(users);
        })
        .catch(() => toast.error("Couldn't load duo partner details."))
        .finally(() => setDuoLoading(false));
    }
  }, [isLinked]);

  // ─── Riot account handlers ────────────────────────────────────────────────

  function handleLink() {
    if (!riotId.includes("#")) {
      toast.error(
        "Please enter your Riot ID as GameName#TagLine (e.g. beagleknight#euw)"
      );
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("riotId", riotId);
      const result = await linkRiotAccount(formData);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Linked to ${result.gameName}#${result.tagLine}`);
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
          toast.success("Riot account unlinked.");
          await updateSession();
        } else {
          toast.error("Failed to unlink Riot account.");
        }
      } catch {
        toast.error("Failed to unlink Riot account.");
      }
    });
  }

  // ─── Invite handlers (admin only) ────────────────────────────────────────

  function handleGenerateInvite() {
    startTransition(async () => {
      try {
        const result = await createInvite();
        toast.success(`Invite code created: ${result.code}`);
        // Refresh invites list
        const updated = await getInvites();
        setInvitesList(updated);
      } catch {
        toast.error("Failed to generate invite code.");
      }
    });
  }

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success("Invite code copied to clipboard");
  }

  function handleDeleteInvite(id: number) {
    if (!confirm("Delete this invite code? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        await deleteInvite(id);
        setInvitesList((prev) => prev.filter((inv) => inv.id !== id));
        toast.success("Invite deleted.");
      } catch {
        toast.error("Failed to delete invite.");
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
        toast.success(`Duo partner set to ${result.partnerName}`);
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
        toast.success("Duo partner cleared.");
        setDuoPartnerState(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account and Riot Games integration.
        </p>
      </div>

      {/* Riot Account Card */}
      <Card className="surface-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Riot Account
            {isLinked ? (
              <Badge
                variant="default"
                className="ml-2 bg-gold/20 text-gold border border-gold/30"
              >
                Linked
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-2">
                Not Linked
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Link your Riot Games account to sync your ranked games
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLinked ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-lg border border-gold/20 p-4 bg-surface-elevated">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Riot ID</p>
                  <p className="text-lg font-semibold text-gold">
                    {session.user.riotGameName}#{session.user.riotTagLine}
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
                  Unlink
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Unlinking will not delete your imported match data.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="riot-id">Riot ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="riot-id"
                    placeholder="beagleknight#euw"
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
                    Link
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter your Riot ID in GameName#TagLine format. This is used to
                import your ranked match history.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Duo Partner Card */}
      {isLinked && (
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gold" />
              Duo Partner
              {duoPartner ? (
                <Badge
                  variant="default"
                  className="ml-2 bg-gold/20 text-gold border border-gold/30"
                >
                  Set
                </Badge>
              ) : (
                <Badge variant="secondary" className="ml-2">
                  Not Set
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Choose your duo partner to track shared games and synergy stats.
            </CardDescription>
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
                <div className="flex items-center gap-4 rounded-lg border border-gold/20 p-4 bg-surface-elevated">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Duo Partner</p>
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
                    Clear
                  </Button>
                </div>
              </div>
            ) : registeredUsers.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Select a registered user as your duo partner:
                </p>
                <div className="space-y-2">
                  {registeredUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 rounded-lg border border-border/50 p-3 bg-surface-elevated"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gold">
                          {u.riotGameName}#{u.riotTagLine}
                        </p>
                        {u.name && (
                          <p className="text-xs text-muted-foreground">
                            {u.name}
                          </p>
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
                        Set
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No other users with linked Riot accounts found. Invite a friend
                to get started!
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Admin Section: Invite Friends */}
      {isAdmin && (
        <Card className="surface-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-gold" />
              Invite Friends
              <Badge variant="secondary" className="ml-2">
                <Shield className="mr-1 h-3 w-3" />
                Admin
              </Badge>
            </CardTitle>
            <CardDescription>
              Generate invite codes to let friends create accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleGenerateInvite}
              disabled={isPending}
              size="sm"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Generate Invite Code
            </Button>

            {invitesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-border/30 p-3">
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
                    className="flex items-center gap-3 rounded-lg border border-border/50 p-3 bg-surface-elevated"
                  >
                    <code className="text-sm font-mono font-semibold text-gold">
                      {invite.code}
                    </code>
                    <div className="flex-1 min-w-0">
                      {invite.usedBy ? (
                        <span className="text-xs text-muted-foreground">
                          Used by{" "}
                          <span className="text-foreground">
                            {invite.usedByName || "Unknown"}
                          </span>
                        </span>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs border-gold/30 text-gold"
                        >
                          Available
                        </Badge>
                      )}
                    </div>
                    {!invite.usedBy && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyCode(invite.code)}
                        className="h-8 w-8 p-0"
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
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No invite codes yet. Generate one to share with friends.
              </p>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}

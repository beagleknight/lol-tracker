"use client";

import { Ticket, User, Shield, UserPlus, Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";

import { demoLogin, getDemoUsers, type DemoUserInfo } from "@/app/actions/demo-login";
import { Logo } from "@/components/logo";
import { RiotDisclaimer } from "@/components/riot-disclaimer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { login } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

// ─── Demo Login Form ──────────────────────────────────────────────────────────

function DemoLoginForm() {
  const t = useTranslations("Login");
  const [loading, setLoading] = useState<string | null>(null);
  const [demoUsers, setDemoUsers] = useState<DemoUserInfo[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    getDemoUsers()
      .then(setDemoUsers)
      .catch(() => {
        // Fallback: empty list
      })
      .finally(() => setUsersLoading(false));
  }, []);

  async function handleDemoLogin(userId: string) {
    setLoading(userId);
    try {
      await demoLogin(userId);
    } catch {
      setLoading(null);
    }
  }

  return (
    <Card className="surface-glow w-full max-w-md border-gold/20">
      <CardHeader className="text-center">
        <div className="glow-gold-sm mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
          <Logo className="h-8 w-8 text-gold" />
        </div>
        <CardTitle className="text-gradient-gold text-2xl">{t("demoModeTitle")}</CardTitle>
        <CardDescription>{t("demoModeDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {usersLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3"
              >
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))
          : demoUsers.map((user) => {
              const hasRiot = !!user.riotGameName;
              const riotId = hasRiot ? `${user.riotGameName}#${user.riotTagLine}` : null;
              const needsSetup = !user.onboardingCompleted;

              return (
                <button
                  key={user.id}
                  onClick={() => void handleDemoLogin(user.id)}
                  disabled={loading !== null}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/50 bg-card p-3 text-left transition-all hover:border-gold/40 hover:bg-gold/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    {user.role === "admin" ? (
                      <Shield className="h-5 w-5 text-gold" />
                    ) : user.role === "premium" ? (
                      <Crown className="h-5 w-5 text-blue-400" />
                    ) : needsSetup ? (
                      <UserPlus className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">{user.name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-xs",
                          user.role === "admin" && "border-gold/30 text-gold",
                          user.role === "premium" && "border-blue-400/30 text-blue-400",
                        )}
                      >
                        {user.role === "admin"
                          ? t("demoRoleAdmin")
                          : user.role === "premium"
                            ? t("demoRolePremium")
                            : t("demoRoleFree")}
                      </Badge>
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {needsSetup ? t("demoNeedsSetup") : hasRiot ? riotId : t("demoNoRiotAccount")}
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center justify-center rounded-md border border-input bg-background px-3 py-1 text-sm font-medium shadow-sm">
                    {loading === user.id ? "..." : t("demoLoginButton")}
                  </span>
                </button>
              );
            })}
      </CardContent>
    </Card>
  );
}

// ─── Discord Login Form ───────────────────────────────────────────────────────

function DiscordLoginForm() {
  const t = useTranslations("Login");
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const inviteParam = searchParams.get("invite") ?? "";
  const [showInvite, setShowInvite] = useState(!!error || !!inviteParam);
  const [inviteCode, setInviteCode] = useState(inviteParam);

  function handleSignIn() {
    // If invite code is provided, store it in a cookie before redirecting
    if (inviteCode.trim()) {
      document.cookie = `invite-code=${encodeURIComponent(inviteCode.trim())}; path=/; max-age=300; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    }
    void login("discord", { callbackUrl: "/dashboard" });
  }

  return (
    <Card className="surface-glow w-full max-w-md border-gold/20">
      <CardHeader className="text-center">
        <div className="glow-gold-sm mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
          <Logo className="h-8 w-8 text-gold" />
        </div>
        <CardTitle className="text-gradient-gold text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error === "invite-required" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {t("errorInviteRequired")}
          </div>
        )}
        {error === "invite-invalid" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {t("errorInviteInvalid")}
          </div>
        )}
        {error === "invite-expired" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {t("errorInviteExpired")}
          </div>
        )}
        {error === "account-deactivated" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {t("errorAccountDeactivated")}
          </div>
        )}

        {showInvite && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Ticket className="h-4 w-4" />
              <span>{t("inviteCodeLabel")}</span>
            </div>
            <Input
              placeholder={t("inviteCodePlaceholder")}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSignIn();
              }}
            />
          </div>
        )}

        <Button onClick={handleSignIn} className="hover-lift w-full" size="lg">
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
          </svg>
          {t("signInWithDiscord")}
        </Button>

        {!showInvite && (
          <button
            onClick={() => setShowInvite(true)}
            className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-gold"
          >
            {t("haveInviteCode")}
          </button>
        )}
        {showInvite && (
          <p className="text-center text-xs text-muted-foreground">{t("alreadyHaveAccount")}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function LoginContent() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  return isDemoMode ? <DemoLoginForm /> : <DiscordLoginForm />;
}

export default function LoginPage() {
  return (
    <div className="bg-mesh relative flex min-h-screen items-center justify-center bg-background">
      <Suspense>
        <LoginContent />
      </Suspense>
      <div className="absolute inset-x-0 bottom-0">
        <RiotDisclaimer />
      </div>
    </div>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Swords, Ticket } from "lucide-react";

function LoginForm() {
  const t = useTranslations("Login");
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const [showInvite, setShowInvite] = useState(!!error);
  const [inviteCode, setInviteCode] = useState("");

  function handleSignIn() {
    // If invite code is provided, store it in a cookie before redirecting
    if (inviteCode.trim()) {
      document.cookie = `invite-code=${encodeURIComponent(inviteCode.trim())}; path=/; max-age=300; SameSite=Lax`;
    }
    signIn("discord", { callbackUrl: "/dashboard" });
  }

  return (
    <Card className="w-full max-w-md border-gold/20 surface-glow">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold/10 glow-gold-sm">
          <Swords className="h-8 w-8 text-gold" />
        </div>
        <CardTitle className="text-2xl text-gradient-gold">
          {t("title")}
        </CardTitle>
        <CardDescription>
          {t("description")}
        </CardDescription>
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

        <Button
          onClick={handleSignIn}
          className="w-full hover-lift"
          size="lg"
        >
          <svg
            className="mr-2 h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
          </svg>
          {t("signInWithDiscord")}
        </Button>

        {!showInvite && (
          <button
            onClick={() => setShowInvite(true)}
            className="w-full text-center text-sm text-muted-foreground hover:text-gold transition-colors"
          >
            {t("haveInviteCode")}
          </button>
        )}
        {showInvite && (
          <p className="text-center text-xs text-muted-foreground">
            {t("alreadyHaveAccount")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-mesh">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}

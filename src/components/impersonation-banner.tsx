"use client";

import { Eye, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useTransition } from "react";
import { toast } from "sonner";

import { stopImpersonation } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-client";

export function ImpersonationBanner() {
  const { user } = useAuth();
  const t = useTranslations("Impersonation");
  const [isPending, startTransition] = useTransition();

  if (!user?.isImpersonating) return null;

  function handleStop() {
    startTransition(async () => {
      try {
        await stopImpersonation();
      } catch (err) {
        // redirect() throws a NEXT_REDIRECT error — let it propagate
        if (isRedirectError(err)) throw err;
        toast.error(t("stopError"));
      }
    });
  }

  return (
    <div className="fixed top-0 right-0 left-0 z-50 flex items-center justify-center gap-3 bg-amber-500/90 px-4 py-2 text-sm font-medium text-black backdrop-blur-sm md:left-64">
      <Eye className="h-4 w-4 shrink-0" />
      <span>
        {t("banner", {
          name: user.name || t("unknownUser"),
          admin: user.realAdminName || "Admin",
        })}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={handleStop}
        disabled={isPending}
        className="ml-2 h-7 gap-1 border-black/20 bg-black/10 text-black hover:bg-black/20 hover:text-black"
      >
        <X className="h-3.5 w-3.5" />
        {t("stopButton")}
      </Button>
    </div>
  );
}

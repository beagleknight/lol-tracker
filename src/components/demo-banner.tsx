"use client";

import { Eye, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { logout } from "@/lib/auth-client";

export function DemoBanner() {
  const t = useTranslations("Demo");

  return (
    <div className="fixed top-0 right-0 left-0 z-50 flex h-10 items-center justify-center gap-2 bg-gold/70 px-4 text-sm font-medium text-background backdrop-blur-sm">
      <Eye className="h-4 w-4" />
      <span>{t("bannerText")}</span>
      <Link href="/login" className="ml-2 underline hover:no-underline">
        {t("bannerSignUp")}
      </Link>
      <button
        type="button"
        onClick={() => void logout({ callbackUrl: "/" })}
        className="ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-background/80 hover:bg-background/10 hover:text-background"
        aria-label={t("bannerExit")}
      >
        <X className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("bannerExit")}</span>
      </button>
    </div>
  );
}

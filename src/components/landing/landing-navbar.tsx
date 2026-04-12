"use client";

import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";

export function LandingNavbar() {
  const t = useTranslations("Landing");

  function toggleLanguage() {
    const currentLang = document.cookie
      .split("; ")
      .find((row) => row.startsWith("language="))
      ?.split("=")[1];
    const newLang = currentLang === "es" ? "en" : "es";
    document.cookie = `language=${newLang}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    window.location.reload();
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo className="h-7 w-7 text-gold" />
          <span className="text-gradient-gold text-lg font-bold">LoL Tracker</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t("nav.languageToggleLabel")}
          >
            <Globe className="h-4 w-4" />
          </button>
          <Link href="/login" className={buttonVariants({ size: "sm" })}>
            {t("nav.signIn")}
          </Link>
        </div>
      </div>
    </nav>
  );
}

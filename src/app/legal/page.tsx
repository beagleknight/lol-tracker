"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Logo } from "@/components/logo";

export default function LegalPage() {
  const t = useTranslations("Legal");

  return (
    <div className="bg-mesh flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl space-y-8 py-12">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Logo className="h-6 w-6 text-gold" />
          <span className="text-gradient-gold text-lg font-semibold">LoL Tracker</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground">{t("pageTitle")}</h1>

        {/* Riot Games disclaimer */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{t("riotDisclaimerHeading")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("riotDisclaimer")}</p>
        </section>

        {/* Open source */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{t("openSourceHeading")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("openSourceText")}</p>
          <a
            href="https://github.com/beagleknight/lol-tracker"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-gold transition-colors hover:text-gold/80"
          >
            {t("openSourceLink")}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </section>

        {/* Privacy policy link */}
        <section className="space-y-3">
          <Link
            href="/legal/privacy"
            className="inline-flex items-center gap-2 text-sm text-gold transition-colors hover:text-gold/80"
          >
            {t("privacyPolicyLink")}
          </Link>
        </section>

        {/* Back link */}
        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToApp")}
          </Link>
        </div>
      </div>
    </div>
  );
}

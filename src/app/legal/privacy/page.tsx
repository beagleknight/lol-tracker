"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Logo } from "@/components/logo";

export default function PrivacyPolicyPage() {
  const t = useTranslations("Privacy");

  return (
    <div className="bg-mesh flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl space-y-8 py-12">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Logo className="h-6 w-6 text-gold" />
          <span className="text-gradient-gold text-lg font-semibold">LoL Tracker</span>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("pageTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("lastUpdated", { date: "2026-04-23" })}
          </p>
        </div>

        {/* Introduction */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{t("introHeading")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("introText")}</p>
        </section>

        {/* Data collection */}
        <section className="space-y-5">
          <h2 className="text-lg font-semibold text-foreground">{t("dataCollectionHeading")}</h2>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">{t("discordDataHeading")}</h3>
            <p className="leading-relaxed text-muted-foreground">{t("discordDataText")}</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">{t("riotDataHeading")}</h3>
            <p className="leading-relaxed text-muted-foreground">{t("riotDataText")}</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">{t("matchDataHeading")}</h3>
            <p className="leading-relaxed text-muted-foreground">{t("matchDataText")}</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">{t("coachingDataHeading")}</h3>
            <p className="leading-relaxed text-muted-foreground">{t("coachingDataText")}</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">{t("aiDataHeading")}</h3>
            <p className="leading-relaxed text-muted-foreground">{t("aiDataText")}</p>
          </div>
        </section>

        {/* Storage */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{t("storageHeading")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("storageText")}</p>
        </section>

        {/* Third-party services */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{t("thirdPartyHeading")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("thirdPartyText")}</p>
          <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
            <li>{t("thirdPartyDiscord")}</li>
            <li>{t("thirdPartyRiot")}</li>
            <li>{t("thirdPartyGemini")}</li>
            <li>{t("thirdPartyVercel")}</li>
            <li>{t("thirdPartyTurso")}</li>
          </ul>
        </section>

        {/* Cookies */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{t("cookiesHeading")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("cookiesText")}</p>
          <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
            <li>{t("cookieSession")}</li>
            <li>{t("cookieLanguage")}</li>
            <li>{t("cookieSeasonFilter")}</li>
            <li>{t("cookieSyncOnLogin")}</li>
            <li>{t("cookieInviteCode")}</li>
          </ul>
        </section>

        {/* Your rights */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{t("rightsHeading")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("rightsText")}</p>
          <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
            <li>{t("rightsAccess")}</li>
            <li>{t("rightsDelete")}</li>
            <li>{t("rightsExport")}</li>
          </ul>
        </section>

        {/* GDPR */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{t("gdprHeading")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("gdprText")}</p>
        </section>

        {/* Contact */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{t("contactHeading")}</h2>
          <p className="leading-relaxed text-muted-foreground">{t("contactText")}</p>
        </section>

        {/* Back link */}
        <div className="pt-4">
          <Link
            href="/legal"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToLegal")}
          </Link>
        </div>
      </div>
    </div>
  );
}

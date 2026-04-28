"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

import { BrowserFrame } from "@/components/landing/browser-frame";
import { buttonVariants } from "@/components/ui/button";

export function LandingHero() {
  const t = useTranslations("Landing");

  return (
    <section className="bg-mesh relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:py-36">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-gradient-gold text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t("hero.tagline")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            {t("hero.subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className={buttonVariants({ size: "lg", className: "hover-lift px-6 text-base" })}
            >
              {t("hero.cta")}
            </Link>
            <Link
              href="/demo"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "px-6 text-base",
              })}
            >
              {t("hero.demoButton")}
            </Link>
          </div>
        </div>

        <div className="mt-16 sm:mt-20">
          <BrowserFrame
            src="/landing/dashboard.png"
            alt="LevelRise dashboard"
            width={1280}
            height={720}
            className="mx-auto max-w-5xl"
            priority
          />
        </div>
      </div>
    </section>
  );
}

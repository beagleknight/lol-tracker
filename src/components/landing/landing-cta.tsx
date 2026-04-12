"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export function LandingCta() {
  const t = useTranslations("Landing");

  return (
    <section className="bg-mesh border-t border-border/50 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-gradient-gold text-3xl font-bold tracking-tight sm:text-4xl">
          {t("cta.heading")}
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">{t("cta.subtitle")}</p>
        <div className="mt-8">
          <Link
            href="/login"
            className={buttonVariants({ size: "lg", className: "hover-lift px-6 text-base" })}
          >
            {t("cta.button")}
          </Link>
        </div>
      </div>
    </section>
  );
}

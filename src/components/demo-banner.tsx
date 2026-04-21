"use client";

import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export function DemoBanner() {
  const t = useTranslations("Demo");

  return (
    <div className="fixed top-0 right-0 left-0 z-50 flex h-10 items-center justify-center gap-2 bg-gold/90 px-4 text-sm font-medium text-background">
      <Eye className="h-4 w-4" />
      <span>{t("bannerText")}</span>
      <Link href="/login" className="ml-2 underline hover:no-underline">
        {t("bannerSignUp")}
      </Link>
    </div>
  );
}

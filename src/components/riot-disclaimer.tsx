"use client";

import { useTranslations } from "next-intl";

export function RiotDisclaimer() {
  const t = useTranslations("Legal");

  return (
    <footer className="mx-auto max-w-lg px-4 py-6 text-center text-xs leading-relaxed text-muted-foreground/60">
      <p>{t("riotDisclaimer")}</p>
    </footer>
  );
}

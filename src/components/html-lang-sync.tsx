"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

/**
 * Syncs the <html lang> attribute with the active locale.
 *
 * The root layout hardcodes lang="en" for PPR compatibility (it must remain
 * static). This component runs client-side inside the NextIntlClientProvider
 * to update the attribute once the resolved locale is available.
 */
export function HtmlLangSync() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}

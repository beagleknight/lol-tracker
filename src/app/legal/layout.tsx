import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Suspense } from "react";

import { HtmlLangSync } from "@/components/html-lang-sync";

/**
 * Async server component that fetches i18n messages for the public legal page.
 * Same pattern as the login layout — no auth required.
 */
async function LocalizedLegalContent({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={messages}>
      <HtmlLangSync />
      {children}
    </NextIntlClientProvider>
  );
}

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <LocalizedLegalContent>{children}</LocalizedLegalContent>
    </Suspense>
  );
}

import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

/**
 * Async server component that fetches i18n messages (reads cookies() internally)
 * and provides them to client components via NextIntlClientProvider.
 * Must be wrapped in <Suspense> because getMessages() accesses cookies(),
 * which is uncached runtime data under cacheComponents: true.
 */
async function LocalizedLoginContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <LocalizedLoginContent>{children}</LocalizedLoginContent>
    </Suspense>
  );
}

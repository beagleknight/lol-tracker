import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Suspense } from "react";

import { InterceptedLoginContent } from "./login-content";

async function LocalizedContent() {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={messages}>
      <InterceptedLoginContent />
    </NextIntlClientProvider>
  );
}

export default function InterceptedLoginPage() {
  return (
    <Suspense>
      <LocalizedContent />
    </Suspense>
  );
}

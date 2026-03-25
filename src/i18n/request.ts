import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from "./languages";

export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from "./languages";

export default getRequestConfig(async () => {
  // 1. Check language cookie (set on login + language change)
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("language")?.value;

  let locale: SupportedLanguage = DEFAULT_LANGUAGE;

  if (cookieLang && SUPPORTED_LANGUAGES.some((l) => l.value === cookieLang)) {
    locale = cookieLang as SupportedLanguage;
  } else {
    // 2. Fallback: check Accept-Language header (for unauthenticated users)
    const headerStore = await headers();
    const acceptLang = headerStore.get("accept-language");
    if (acceptLang) {
      // Parse "es-ES,es;q=0.9,en;q=0.8" — extract primary language codes
      const preferred = acceptLang
        .split(",")
        .map((part) => part.split(";")[0].trim().split("-")[0].toLowerCase());
      const match = preferred.find((lang) =>
        SUPPORTED_LANGUAGES.some((l) => l.value === lang)
      );
      if (match) {
        locale = match as SupportedLanguage;
      }
    }
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

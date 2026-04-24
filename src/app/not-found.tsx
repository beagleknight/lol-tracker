"use client";

import { Home } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export default function NotFound() {
  let title = "Page not found";
  let description = "The page you're looking for doesn't exist or has been moved.";
  let backLabel = "Back to dashboard";

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- safe: always called, try/catch only guards missing provider
    const t = useTranslations("NotFound");
    title = t("title");
    description = t("description");
    backLabel = t("backToDashboard");
  } catch {
    // NextIntlClientProvider not available (root-level 404) — use English defaults
  }

  return (
    <div className="bg-mesh flex min-h-screen items-center justify-center">
      <div className="mx-auto max-w-md space-y-6 px-6 text-center">
        <p className="text-gradient-gold text-8xl font-bold tracking-tighter">404</p>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Home className="size-4" />
          {backLabel}
        </Link>
      </div>
    </div>
  );
}

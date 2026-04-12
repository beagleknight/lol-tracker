import { useTranslations } from "next-intl";
import Link from "next/link";

import { Logo } from "@/components/logo";

export function LandingFooter() {
  const t = useTranslations("Landing");

  return (
    <footer className="border-t border-border/50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <Logo className="h-5 w-5 text-gold" />
            <span className="text-sm font-medium text-foreground">LoL Tracker</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/legal"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("footer.legal")}
            </Link>
            <a
              href="https://github.com/beagleknight/lol-tracker"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("footer.sourceCode")}
            </a>
          </div>
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground/60 sm:text-left">
          {t("footer.riotDisclaimer")}
        </p>
      </div>
    </footer>
  );
}

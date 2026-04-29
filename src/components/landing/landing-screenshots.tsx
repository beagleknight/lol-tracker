import { useTranslations } from "next-intl";

import { BrowserFrame } from "@/components/landing/browser-frame";

const SCREENSHOTS = [
  { key: "dashboard" as const, src: "/landing/dashboard.png" },
  { key: "analytics" as const, src: "/landing/analytics.png" },
  { key: "coaching" as const, src: "/landing/coaching.png" },
];

export function LandingScreenshots() {
  const t = useTranslations("Landing");

  return (
    <section className="border-t border-border/50 bg-muted/30 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("screenshots.heading")}
        </h2>

        <div className="mt-14 space-y-16">
          {SCREENSHOTS.map(({ key, src }, index) => (
            <div
              key={key}
              className={`flex flex-col items-center gap-8 lg:flex-row lg:gap-12 ${
                index % 2 !== 0 ? "lg:flex-row-reverse" : ""
              }`}
            >
              <div className="flex-1">
                <BrowserFrame src={src} alt={`LevelRise ${key}`} width={1280} height={720} />
              </div>
              <div className="max-w-md flex-shrink-0 text-center lg:text-left">
                <p className="text-lg leading-relaxed text-muted-foreground">
                  {t(`screenshots.${key}`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

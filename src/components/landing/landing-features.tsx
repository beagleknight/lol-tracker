import { BarChart3, ClipboardCheck, GraduationCap, Swords } from "lucide-react";
import { useTranslations } from "next-intl";

const FEATURES = [
  { key: "matchTracking" as const, icon: Swords },
  { key: "gameReview" as const, icon: ClipboardCheck },
  { key: "analytics" as const, icon: BarChart3 },
  { key: "coaching" as const, icon: GraduationCap },
];

export function LandingFeatures() {
  const t = useTranslations("Landing");

  return (
    <section className="border-t border-border/50 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("features.heading")}
        </h2>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className="surface-glow hover-lift rounded-xl border border-border/50 bg-card p-6"
            >
              <div className="glow-gold-sm mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-gold/10">
                <Icon className="h-5 w-5 text-gold" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {t(`features.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(`features.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

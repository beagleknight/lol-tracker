import { Crosshair, Globe, Target, Trophy, Users } from "lucide-react";
import { useTranslations } from "next-intl";

const SECONDARY_FEATURES = [
  { key: "matchupScout" as const, icon: Crosshair },
  { key: "goalTracking" as const, icon: Target },
  { key: "duoPartner" as const, icon: Users },
  { key: "multiAccount" as const, icon: Trophy },
  { key: "bilingual" as const, icon: Globe },
];

export function LandingSecondary() {
  const t = useTranslations("Landing");

  return (
    <section className="border-t border-border/50 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("secondary.heading")}
        </h2>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SECONDARY_FEATURES.map(({ key, icon: Icon }) => (
            <div key={key} className="flex items-start gap-3 rounded-lg p-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
              <div>
                <h3 className="font-medium text-foreground">{t(`secondary.${key}.title`)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`secondary.${key}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

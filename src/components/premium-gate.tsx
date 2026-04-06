"use client";

import { Crown } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";

export function PremiumGate() {
  const t = useTranslations("Premium");

  return (
    <div className="relative">
      {/* Blurred placeholder content */}
      <div className="pointer-events-none blur-sm select-none" aria-hidden="true">
        <div className="grid grid-cols-2 gap-4 p-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="mb-2 h-6 w-24 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted" />
            </Card>
          ))}
        </div>
        <div className="px-6">
          <Card className="p-4">
            <div className="mb-3 h-12 w-full rounded bg-muted" />
            <div className="mb-3 h-12 w-full rounded bg-muted" />
            <div className="h-12 w-full rounded bg-muted" />
          </Card>
        </div>
      </div>

      {/* Premium gate overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Card className="max-w-sm border-gold/30 shadow-lg">
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
              <Crown className="h-7 w-7 text-gold" />
            </div>
            <h3 className="text-lg font-semibold">{t("gateTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("gateDescription")}</p>
            <p className="text-xs text-muted-foreground">{t("gateContact")}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

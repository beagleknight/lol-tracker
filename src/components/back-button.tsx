"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function BackButton() {
  const router = useRouter();
  const t = useTranslations("Common");

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("backToPreviousPage")}
      onClick={() => router.back()}
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
}

"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations("Errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center space-y-4 py-24 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold">{t("title")}</h2>
      <p className="max-w-md text-muted-foreground">{t("description")}</p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          {t("errorId", { digest: error.digest })}
        </p>
      )}
      <div className="flex gap-3">
        <Button onClick={() => unstable_retry()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t("tryAgain")}
        </Button>
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
          {t("goToDashboard")}
        </Button>
      </div>
    </div>
  );
}

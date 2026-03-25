"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

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
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold">{t("title")}</h2>
      <p className="text-muted-foreground max-w-md">
        {t("description")}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">
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

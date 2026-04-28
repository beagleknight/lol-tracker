"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Suspense } from "react";

import { LoginContent, LegalLink } from "@/app/login/login-forms";

export default function LoginPage() {
  const t = useTranslations("Login");
  return (
    <div className="bg-mesh relative flex min-h-screen items-center justify-center bg-background">
      <Link
        href="/"
        className="absolute top-4 left-4 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToHome")}
      </Link>
      <Suspense>
        <LoginContent />
      </Suspense>
      <div className="absolute inset-x-0 bottom-0 pb-4 text-center">
        <LegalLink />
      </div>
    </div>
  );
}

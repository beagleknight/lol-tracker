"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ChangelogTag } from "@/lib/changelog";
import { cn } from "@/lib/utils";

function buildPageUrl(page: number, activeTag: ChangelogTag | undefined): string {
  const sp = new URLSearchParams();
  if (activeTag) sp.set("tag", activeTag);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return `/changelog${qs ? `?${qs}` : ""}`;
}

export function ChangelogPagination({
  currentPage,
  totalPages,
  activeTag,
}: {
  currentPage: number;
  totalPages: number;
  activeTag: ChangelogTag | undefined;
}) {
  const t = useTranslations("Changelog");

  return (
    <div className="flex items-center justify-center gap-4 pt-2">
      {currentPage > 1 ? (
        <Link
          href={buildPageUrl(currentPage - 1, activeTag)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {t("previousPage")}
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft className="h-4 w-4 mr-1" />
          {t("previousPage")}
        </Button>
      )}

      <span className="text-sm text-muted-foreground">
        {t("pageIndicator", { current: currentPage, total: totalPages })}
      </span>

      {currentPage < totalPages ? (
        <Link
          href={buildPageUrl(currentPage + 1, activeTag)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          {t("nextPage")}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled>
          {t("nextPage")}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </div>
  );
}

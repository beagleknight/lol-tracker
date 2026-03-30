"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize = PAGE_SIZE,
  onPageChange,
}: PaginationProps) {
  const t = useTranslations("Pagination");
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1) return null;

  // Build page numbers to show: first, last, current +/- 1, with ellipsis
  const pages: (number | "ellipsis")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground">
            {t("ellipsis")}
          </span>
        ) : (
          <Button
            key={p}
            variant={p === currentPage ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8 text-xs"
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ),
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** Paginate an array client-side. Returns the slice for the given page. */
export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export { PAGE_SIZE };

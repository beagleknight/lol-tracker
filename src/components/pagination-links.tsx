import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;

interface PaginationLinksProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  /** Base path, e.g. "/coaching". Page param is appended as ?page=N */
  basePath: string;
}

export function PaginationLinks({
  currentPage,
  totalItems,
  pageSize = PAGE_SIZE,
  basePath,
}: PaginationLinksProps) {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1) return null;

  // Build page numbers to show: first, last, current +/- 1, with ellipsis
  const pages: (number | "ellipsis")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  function href(page: number) {
    return page === 1 ? basePath : `${basePath}?page=${page}`;
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      {currentPage === 1 ? (
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      ) : (
        <Link href={href(currentPage - 1)}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
      )}
      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span
            key={`e-${i}`}
            className="px-1 text-xs text-muted-foreground"
          >
            ...
          </span>
        ) : (
          <Link key={p} href={href(p)}>
            <Button
              variant={p === currentPage ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8 text-xs"
            >
              {p}
            </Button>
          </Link>
        )
      )}
      {currentPage === totalPages ? (
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
          <ChevronRight className="h-4 w-4" />
        </Button>
      ) : (
        <Link href={href(currentPage + 1)}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}

export { PAGE_SIZE };

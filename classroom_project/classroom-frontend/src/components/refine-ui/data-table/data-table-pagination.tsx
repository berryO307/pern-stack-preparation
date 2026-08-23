"use client";

import type { MouseEvent } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { buildPageWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type DataTablePaginationProps = {
  currentPage: number;
  pageCount: number;
  setCurrentPage: (page: number) => void;
};

// Previous/Next are direct children of the <nav> (not wrapped in a <li>),
// and only the numbered links live inside the <ul> - keeps three
// justify-between groups without nesting a <div> inside a <ul>, which
// `<li>`-only children would otherwise require.
export function DataTablePagination({
  currentPage,
  pageCount,
  setCurrentPage,
}: DataTablePaginationProps) {
  const tokens = buildPageWindow(currentPage, pageCount);
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= pageCount;

  const goTo = (page: number) => (event: MouseEvent) => {
    event.preventDefault();
    if (page < 1 || page > pageCount || page === currentPage) return;
    setCurrentPage(page);
  };

  return (
    <Pagination className="justify-between">
      <PaginationPrevious
        href="#"
        onClick={goTo(currentPage - 1)}
        aria-disabled={isFirstPage}
        tabIndex={isFirstPage ? -1 : undefined}
        className={cn(isFirstPage && "pointer-events-none opacity-50")}
      />

      {/* Numbered links only from md up - on a phone there isn't room for
          five page links plus Previous/Next, so mobile gets a plain page
          indicator instead of a second, cut-down numbering scheme. */}
      <PaginationContent className="hidden md:flex">
        {tokens.map((token, index) =>
          token === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={token}>
              <PaginationLink
                href="#"
                isActive={token === currentPage}
                onClick={goTo(token)}
              >
                {token}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
      </PaginationContent>
      <span className="text-sm text-muted-foreground md:hidden" aria-live="polite">
        Page {currentPage} of {pageCount}
      </span>

      <PaginationNext
        href="#"
        onClick={goTo(currentPage + 1)}
        aria-disabled={isLastPage}
        tabIndex={isLastPage ? -1 : undefined}
        className={cn(isLastPage && "pointer-events-none opacity-50")}
      />
    </Pagination>
  );
}

DataTablePagination.displayName = "DataTablePagination";

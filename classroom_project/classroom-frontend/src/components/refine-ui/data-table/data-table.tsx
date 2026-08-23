"use client";

import type { HttpError, BaseRecord } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { Column } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/refine-ui/data-table/data-table-pagination";
import { cn } from "@/lib/utils";

type DataTableProps<TData extends BaseRecord> = {
  table: UseTableReturnType<TData, HttpError>;
  /** Screen-reader-only table description (e.g. "Faculty members"). */
  caption?: string;
  /** Noun for the empty-state copy, e.g. "faculty members". Defaults to "data". */
  emptyStateLabel?: string;
  /** Rendered in the empty state when there's genuinely no data yet (e.g. a Create button). */
  emptyStateAction?: React.ReactNode;
  /**
   * True when the current zero-row result is because of an active
   * search/filter, not because the table is actually empty - these need
   * different copy, or a filtered demo table permanently reads as broken.
   */
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
};

export function DataTable<TData extends BaseRecord>({
  table,
  caption,
  emptyStateLabel,
  emptyStateAction,
  hasActiveFilters,
  onClearFilters,
}: DataTableProps<TData>) {
  const {
    reactTable: { getHeaderGroups, getRowModel, getAllColumns },
    refineCore: {
      tableQuery,
      currentPage,
      setCurrentPage,
      pageCount,
      pageSize,
    },
  } = table;

  const columns = getAllColumns();
  const leafColumns = table.reactTable.getAllLeafColumns();
  const isLoading = tableQuery.isLoading;

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [isOverflowing, setIsOverflowing] = useState({
    horizontal: false,
    vertical: false,
  });

  useEffect(() => {
    const checkOverflow = () => {
      if (tableRef.current && tableContainerRef.current) {
        const table = tableRef.current;
        const container = tableContainerRef.current;

        const horizontalOverflow = table.offsetWidth > container.clientWidth;
        const verticalOverflow = table.offsetHeight > container.clientHeight;

        setIsOverflowing({
          horizontal: horizontalOverflow,
          vertical: verticalOverflow,
        });
      }
    };

    checkOverflow();

    // Check on window resize
    window.addEventListener("resize", checkOverflow);

    // Check when table data changes
    const timeoutId = setTimeout(checkOverflow, 100);

    return () => {
      window.removeEventListener("resize", checkOverflow);
      clearTimeout(timeoutId);
    };
  }, [tableQuery.data?.data, pageSize]);

  return (
    <div className={cn("flex", "flex-col", "flex-1", "gap-4")}>
      <div ref={tableContainerRef} className={cn("rounded-lg", "border")}>
        <Table ref={tableRef} style={{ tableLayout: "fixed", width: "100%" }}>
          {caption && <TableCaption className="sr-only">{caption}</TableCaption>}
          <TableHeader>
            {getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
                {headerGroup.headers.map((header) => {
                  const isPlaceholder = header.isPlaceholder;

                  return (
                    <TableHead
                      key={header.id}
                      scope="col"
                      className={header.column.columnDef.meta?.className}
                      style={{
                        ...getCommonStyles({
                          column: header.column,
                          isOverflowing: isOverflowing,
                        }),
                      }}
                    >
                      {isPlaceholder ? null : (
                        <div className={cn("flex", "items-center", "gap-1")}>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="relative">
            {isLoading ? (
              // Real skeleton placeholders at the final row height, not a
              // spinner over blank space - nothing shifts once data arrives,
              // since these rows already reserve exactly as much room.
              Array.from({ length: pageSize < 1 ? 1 : pageSize }).map(
                (_, rowIndex) => (
                  <TableRow key={`skeleton-row-${rowIndex}`} aria-hidden="true">
                    {leafColumns.map((column) => (
                      <TableCell
                        key={`skeleton-cell-${rowIndex}-${column.id}`}
                        style={{
                          ...getCommonStyles({
                            column,
                            isOverflowing: isOverflowing,
                          }),
                        }}
                        className={cn("truncate", column.columnDef.meta?.className)}
                      >
                        <Skeleton className="h-4 w-3/4" />
                      </TableCell>
                    ))}
                  </TableRow>
                )
              )
            ) : getRowModel().rows?.length ? (
              getRowModel().rows.map((row, rowIndex) => {
                return (
                  <TableRow
                    key={row.original?.id ?? row.id}
                    data-state={row.getIsSelected() && "selected"}
                    // Zebra tint on even rows, kept visually distinct from the
                    // hover state (a stronger tint) rather than the same
                    // shade, or hovering would look identical to resting.
                    className={rowIndex % 2 === 1 ? "bg-muted/30" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <TableCell
                          key={cell.id}
                          className={cell.column.columnDef.meta?.className}
                          style={{
                            ...getCommonStyles({
                              column: cell.column,
                              isOverflowing: isOverflowing,
                            }),
                          }}
                        >
                          <div className="truncate">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <DataTableNoData
                isOverflowing={isOverflowing}
                columnsLength={columns.length}
                emptyStateLabel={emptyStateLabel}
                emptyStateAction={emptyStateAction}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={onClearFilters}
              />
            )}
          </TableBody>
        </Table>
      </div>
      {!isLoading && getRowModel().rows?.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          pageCount={pageCount}
          setCurrentPage={setCurrentPage}
        />
      )}
    </div>
  );
}

function DataTableNoData({
  isOverflowing,
  columnsLength,
  emptyStateLabel,
  emptyStateAction,
  hasActiveFilters,
  onClearFilters,
}: {
  isOverflowing: { horizontal: boolean; vertical: boolean };
  columnsLength: number;
  emptyStateLabel?: string;
  emptyStateAction?: React.ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}) {
  // Two different messages on purpose - a filtered view returning zero rows
  // isn't the same situation as a table that's actually empty, and
  // conflating them is what makes a filtered demo table look broken.
  const { title, subtitle, action } = hasActiveFilters
    ? {
        title: "No results match your filters",
        subtitle: "Try a different search or adjust your filters.",
        action: onClearFilters ? (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        ) : null,
      }
    : {
        title: `No ${emptyStateLabel ?? "data"} yet`,
        subtitle: "This table is empty for the time being.",
        action: emptyStateAction ?? null,
      };

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={columnsLength}
        className={cn("relative", "text-center")}
        style={{ height: "490px" }}
      >
        <div
          className={cn(
            "absolute",
            "inset-0",
            "flex",
            "flex-col",
            "items-center",
            "justify-center",
            "gap-2",
            "bg-background"
          )}
          style={{
            position: isOverflowing.horizontal ? "sticky" : "absolute",
            left: isOverflowing.horizontal ? "50%" : "50%",
            transform: "translateX(-50%)",
            zIndex: isOverflowing.horizontal ? 2 : 1,
            width: isOverflowing.horizontal ? "fit-content" : "100%",
            minWidth: "300px",
          }}
        >
          <div className={cn("text-lg", "font-semibold", "text-foreground")}>{title}</div>
          <div className={cn("text-sm", "text-muted-foreground")}>{subtitle}</div>
          {action && <div className="mt-2">{action}</div>}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function getCommonStyles<TData>({
  column,
  isOverflowing,
}: {
  column: Column<TData>;
  isOverflowing: {
    horizontal: boolean;
    vertical: boolean;
  };
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinnedColumn =
    isPinned === "right" && column.getIsFirstColumn("right");

  return {
    boxShadow:
      isOverflowing.horizontal && isLastLeftPinnedColumn
        ? "-4px 0 4px -4px var(--border) inset"
        : isOverflowing.horizontal && isFirstRightPinnedColumn
        ? "4px 0 4px -4px var(--border) inset"
        : undefined,
    left:
      isOverflowing.horizontal && isPinned === "left"
        ? `${column.getStart("left")}px`
        : undefined,
    right:
      isOverflowing.horizontal && isPinned === "right"
        ? `${column.getAfter("right")}px`
        : undefined,
    opacity: 1,
    position: isOverflowing.horizontal && isPinned ? "sticky" : "relative",
    background: isOverflowing.horizontal && isPinned ? "var(--background)" : "",
    borderTopRightRadius:
      isOverflowing.horizontal && isPinned === "right"
        ? "var(--radius)"
        : undefined,
    borderBottomRightRadius:
      isOverflowing.horizontal && isPinned === "right"
        ? "var(--radius)"
        : undefined,
    borderTopLeftRadius:
      isOverflowing.horizontal && isPinned === "left"
        ? "var(--radius)"
        : undefined,
    borderBottomLeftRadius:
      isOverflowing.horizontal && isPinned === "left"
        ? "var(--radius)"
        : undefined,
    width:
      column.columnDef.meta?.flex || column.columnDef.meta?.className
        ? undefined
        : column.getSize(),
    zIndex: isOverflowing.horizontal && isPinned ? 1 : 0,
  };
}

DataTable.displayName = "DataTable";

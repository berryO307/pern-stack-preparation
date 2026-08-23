import "@tanstack/react-table";
import type { CrudOperators } from "@refinedev/core";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Column takes all remaining table width instead of a fixed pixel size. */
    flex?: boolean;
    /**
     * Tailwind width utility (e.g. "w-[120px]") applied to both the header
     * and body cells, in place of the numeric `size` -> inline-style width.
     * A real CSS width wins a table-layout:fixed column's width the same way
     * an inline style would, so this is just a declarative way to say
     * "this exact width, not `size`'s pixel guess".
     */
    className?: string;
    /** Set by data-table-filter.tsx's date pickers to track the active filter operator. */
    filterOperator?: CrudOperators;
  }
}

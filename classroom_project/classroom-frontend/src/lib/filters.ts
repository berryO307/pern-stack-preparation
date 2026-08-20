import type { CrudFilter } from "@refinedev/core";

export function getFilterValue(filters: CrudFilter[], field: string): string {
  const match = filters.find(
    (filter): filter is Extract<CrudFilter, { field: string }> =>
      "field" in filter && filter.field === field,
  );

  return match ? String(match.value ?? "") : "";
}

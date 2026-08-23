export type PageToken = number | "ellipsis";

// Always includes page 1, the last page, and current±1; a real gap between
// consecutive kept pages becomes a single "ellipsis" token. Computing the
// gap directly (rather than always inserting an ellipsis next to the first/
// last page) is what avoids the classic "1 … 2 3 4 … 5" bug - an ellipsis
// hiding zero actual pages, right next to a page it's adjacent to anyway.
export function buildPageWindow(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= 0) return [];
  if (totalPages === 1) return [1];

  const kept = new Set<number>([1, totalPages]);
  for (let page = currentPage - 1; page <= currentPage + 1; page++) {
    if (page >= 1 && page <= totalPages) kept.add(page);
  }

  const sorted = [...kept].sort((a, b) => a - b);
  const tokens: PageToken[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) {
      tokens.push("ellipsis");
    }
    tokens.push(sorted[i]!);
  }
  return tokens;
}

import { buildPageWindow, type PageToken } from "../src/lib/pagination.ts";

// Standalone verification - run manually with
// `npx tsx scripts/verify-pagination-window.ts`. No test framework is wired
// into this project yet (matches the backend's own convention of
// standalone tsx-run verification scripts rather than adding one just for
// this), so this is a real, runnable regression check rather than a
// vitest/jest file nothing executes.
//
// Covers Part D's explicit ask: exercise the page-window generator at
// total-page counts of 1, 2, 7, 8, and 50, and specifically assert against
// the "1 … 2 3 4 … 5" bug - an ellipsis that hides zero actual pages.

const failures: string[] = [];

function tokensToString(tokens: PageToken[]): string {
  return tokens.join(" ");
}

function assertEqual(label: string, actual: PageToken[], expected: PageToken[]) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: got [${tokensToString(actual)}]${ok ? "" : `, expected [${tokensToString(expected)}]`}`);
  if (!ok) failures.push(label);
}

// An ellipsis between two consecutive numbers (gap of exactly 1) hides zero
// actual pages - that's the named bug. Hiding one or more real pages (gap
// >= 2) is a legitimate, normal use of an ellipsis, not a bug.
function assertNoWastedEllipsis(label: string, tokens: PageToken[]) {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== "ellipsis") continue;
    const before = tokens[i - 1];
    const after = tokens[i + 1];
    if (typeof before === "number" && typeof after === "number" && after - before <= 1) {
      console.log(`FAIL ${label}: wasted ellipsis between ${before} and ${after} (hides 0 pages)`);
      failures.push(`${label} (wasted ellipsis)`);
    }
  }
}

// totalPages = 1: just the one page, no ellipsis, nothing else possible.
assertEqual("totalPages=1, currentPage=1", buildPageWindow(1, 1), [1]);

// totalPages = 2: both pages fit with room to spare - never needs an ellipsis.
assertEqual("totalPages=2, currentPage=1", buildPageWindow(1, 2), [1, 2]);
assertEqual("totalPages=2, currentPage=2", buildPageWindow(2, 2), [1, 2]);

// totalPages = 7: near the start, the "current±1" window overlaps page 1,
// so only one ellipsis is needed (between 2 and 7), never two.
assertEqual("totalPages=7, currentPage=1", buildPageWindow(1, 7), [1, 2, "ellipsis", 7]);
assertEqual("totalPages=7, currentPage=4", buildPageWindow(4, 7), [1, "ellipsis", 3, 4, 5, "ellipsis", 7]);
assertEqual("totalPages=7, currentPage=7", buildPageWindow(7, 7), [1, "ellipsis", 6, 7]);

// totalPages = 8: same shape, one page wider.
assertEqual("totalPages=8, currentPage=1", buildPageWindow(1, 8), [1, 2, "ellipsis", 8]);
assertEqual("totalPages=8, currentPage=8", buildPageWindow(8, 8), [1, "ellipsis", 7, 8]);

// totalPages = 50: the real-world "big table" case - both ellipses present,
// only 5 numbers ever rendered regardless of how large totalPages gets.
assertEqual("totalPages=50, currentPage=1", buildPageWindow(1, 50), [1, 2, "ellipsis", 50]);
assertEqual("totalPages=50, currentPage=25", buildPageWindow(25, 50), [1, "ellipsis", 24, 25, 26, "ellipsis", 50]);
assertEqual("totalPages=50, currentPage=50", buildPageWindow(50, 50), [1, "ellipsis", 49, 50]);

// The specific named bug: a small totalPages must never produce a
// "1 … 2 3 4 … 5"-shaped result - if every page already fits, show them all.
assertEqual("totalPages=5, currentPage=3 (all pages fit, no ellipsis)", buildPageWindow(3, 5), [1, 2, 3, 4, 5]);

for (const [current, total] of [
  [1, 1], [1, 2], [2, 2], [1, 7], [4, 7], [7, 7], [1, 8], [8, 8], [1, 50], [25, 50], [50, 50], [3, 5],
]) {
  assertNoWastedEllipsis(`totalPages=${total}, currentPage=${current}`, buildPageWindow(current!, total!));
}

if (failures.length > 0) {
  console.error(`\nFAIL: ${failures.length} case(s) failed:\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("\nPASS: all pagination window cases correct");

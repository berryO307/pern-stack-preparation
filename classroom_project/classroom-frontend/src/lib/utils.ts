import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Uppercase, two letters: first initial + last initial, or just the first
// initial for a single-word name. The fallback state for anyone without a
// photo, not an error case - so it needs to look deliberate everywhere an
// Avatar appears, not just wherever it was first written.
export function getInitials(name = "") {
  const names = name.trim().split(/\s+/);
  let initials = names[0]?.substring(0, 1).toUpperCase() ?? "";
  if (names.length > 1) {
    initials += names[names.length - 1]!.substring(0, 1).toUpperCase();
  }
  return initials || "?";
}

// Single fallback chain for displaying a person's name: their own name, then
// the local part of their email (an actual GitHub-account-with-no-name is
// the real case this covers, not a hypothetical - see lib/auth.ts), then a
// generic "there" so a greeting still reads as a sentence. Every place a
// person's name renders as text (greeting, sidebar footer, person cells,
// activity feed) should go through this instead of inlining `name ?? "..."`
// per call site, so the fallback behavior can't drift between them.
export function displayName(
  person?: { name?: string | null; email?: string | null } | null,
): string {
  const name = person?.name?.trim();
  if (name) return name;
  const emailLocalPart = person?.email?.split("@")[0]?.trim();
  if (emailLocalPart) return emailLocalPart;
  return "there";
}

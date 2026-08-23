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

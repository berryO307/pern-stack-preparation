// Decorative, not semantic - a subject's tint is only ever a stable visual
// grouping cue (same subject = same colour across pages and reloads), never
// a signal in its own right. The theme's --chart-1..5 tokens are all one
// hue at different lightness steps (this theme's chart palette is
// monochrome blue), which read as "everything is purple" - Tailwind's own
// palette gives real hue variety instead, same approach as DepartmentBadge.
// Shared by the Classes list (badge/avatar-fallback classes) and the class
// detail page (banner-generation hex colours) so the same subject renders
// the same colour everywhere, not three independently-hashed palettes.

// Full literal class strings (not template-interpolated) because Tailwind's
// scanner only picks up complete strings it can find in source.
export const SUBJECT_TINT_BADGE_CLASSES = [
  "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-transparent",
  "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-transparent",
  "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-transparent",
  "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-transparent",
  "bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border-transparent",
  "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-transparent",
  "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-transparent",
  "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-transparent",
];

export const SUBJECT_TINT_AVATAR_CLASSES = [
  "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300",
  "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300",
  "bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300",
  "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300",
  "bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300",
  "bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300",
  "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300",
  "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300",
];

// Same 8 hues as the classes above, as literal hex (Cloudinary's co_rgb/
// e_colorize transformations need a real hex, not a CSS variable or
// Tailwind class) - index-for-index the same colour as the badge/avatar
// arrays, so a subject's generated banner and its small badge always match.
export const SUBJECT_TINT_HEX_COLORS = [
  "2563eb", // blue-600
  "9333ea", // purple-600
  "16a34a", // green-600
  "d97706", // amber-600
  "db2777", // pink-600
  "0d9488", // teal-600
  "4f46e5", // indigo-600
  "e11d48", // rose-600
];

export const hashToTintIndex = (seed: number | string): number => {
  const str = String(seed);
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return hash % SUBJECT_TINT_BADGE_CLASSES.length;
};

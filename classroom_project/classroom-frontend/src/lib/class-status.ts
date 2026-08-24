export type ClassStatus = "active" | "inactive" | "archived";

export type ClassStatusMeta = {
  label: string;
  dotClassName: string;
  labelClassName: string;
};

// The single source of truth for how a class status renders - consumed by
// the Classes list, the class detail page, and the Filters popover. Three
// copies of this mapping would drift the moment a fourth status shows up.
// Dot colour is the only colour literal in the status-rendering diff; the
// pill background always stays neutral (bg-muted), so meaning never rides
// on colour alone (amber vs. grey is easy to miss for some viewers - the
// Title-case label next to it is what actually carries the information).
export const CLASS_STATUS_META: Record<ClassStatus, ClassStatusMeta> = {
  active: { label: "Active", dotClassName: "bg-emerald-500", labelClassName: "text-foreground" },
  inactive: { label: "Inactive", dotClassName: "bg-amber-500", labelClassName: "text-foreground" },
  archived: { label: "Archived", dotClassName: "bg-muted-foreground", labelClassName: "text-muted-foreground" },
};

const FALLBACK_STATUS_META: ClassStatusMeta = {
  label: "",
  dotClassName: "bg-muted-foreground",
  labelClassName: "text-muted-foreground",
};

// Unknown/null status degrades to the neutral "archived" styling with the
// raw value as its own label, rather than crashing or rendering an empty
// pill on a value the enum doesn't officially carry yet.
export function getClassStatusMeta(status: string | null | undefined): ClassStatusMeta {
  if (!status) return { ...FALLBACK_STATUS_META, label: "Unknown" };
  const known = CLASS_STATUS_META[status as ClassStatus];
  if (known) return known;
  return { ...FALLBACK_STATUS_META, label: status };
}

export const CLASS_STATUS_OPTIONS: { value: ClassStatus; label: string }[] = (
  Object.keys(CLASS_STATUS_META) as ClassStatus[]
).map((value) => ({ value, label: CLASS_STATUS_META[value].label }));

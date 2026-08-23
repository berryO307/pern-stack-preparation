import { cn } from "@/lib/utils";

type DepartmentColorClasses = { bg: string; text: string; border: string };

// Pale background / deep text of the same hue, each with a dark-mode pair -
// this app's shadcn theme tokens (primary/secondary/muted) don't carry
// per-category hue identity, so this deliberately reaches for Tailwind's
// built-in palette directly instead. Still no raw hex/oklch literals, just
// utility classes, but it is a real exception to "tint-vs-neutral only" -
// flagging that rather than burying it.
const DEPARTMENT_COLOR_PALETTE: DepartmentColorClasses[] = [
  { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-100 dark:border-blue-900" },
  { bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", border: "border-purple-100 dark:border-purple-900" },
  { bg: "bg-green-50 dark:bg-green-950/40", text: "text-green-700 dark:text-green-300", border: "border-green-100 dark:border-green-900" },
  { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-100 dark:border-amber-900" },
  { bg: "bg-pink-50 dark:bg-pink-950/40", text: "text-pink-700 dark:text-pink-300", border: "border-pink-100 dark:border-pink-900" },
  { bg: "bg-teal-50 dark:bg-teal-950/40", text: "text-teal-700 dark:text-teal-300", border: "border-teal-100 dark:border-teal-900" },
];

const FALLBACK_COLOR: DepartmentColorClasses = {
  bg: "bg-gray-100 dark:bg-gray-800/60",
  text: "text-gray-700 dark:text-gray-300",
  border: "border-gray-200 dark:border-gray-700",
};

// Fixed pairings for the departments this demo actually seeds, so they stay
// visually consistent across reseeds; anything else falls through to a
// deterministic hash pick rather than always landing on the gray fallback -
// a genuinely new department still gets a stable, distinct color.
const KNOWN_DEPARTMENT_COLOR_INDEX: Record<string, number> = {
  "Computer Science": 0,
  Mathematics: 1,
  "Business Administration": 2,
  "Fine Arts": 3,
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getDepartmentColorClasses(name: string): DepartmentColorClasses {
  if (!name) return FALLBACK_COLOR;
  const knownIndex = KNOWN_DEPARTMENT_COLOR_INDEX[name];
  const index = knownIndex ?? hashString(name) % DEPARTMENT_COLOR_PALETTE.length;
  return DEPARTMENT_COLOR_PALETTE[index] ?? FALLBACK_COLOR;
}

type DepartmentBadgeProps = {
  name: string;
  className?: string;
};

export function DepartmentBadge({ name, className }: DepartmentBadgeProps) {
  const colors = getDepartmentColorClasses(name);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium whitespace-nowrap",
        colors.bg,
        colors.text,
        colors.border,
        className,
      )}
    >
      {name}
    </span>
  );
}

type DepartmentListItem = { id: string | number; name: string };

type DepartmentBadgeListProps = {
  departments: DepartmentListItem[];
};

// The reusable "list container" half of the request, for using the badge
// somewhere standalone (outside a table, which already has its own row
// borders and padding). Divider color and text stay on semantic tokens -
// only the badge pill itself uses the hue-mapped palette above.
export function DepartmentBadgeList({ departments }: DepartmentBadgeListProps) {
  return (
    <ul className="divide-y divide-border">
      {departments.map((department) => (
        <li key={department.id} className="flex items-center px-4 py-4">
          <DepartmentBadge name={department.name} />
        </li>
      ))}
    </ul>
  );
}

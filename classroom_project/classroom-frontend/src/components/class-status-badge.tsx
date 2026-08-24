import { cn } from "@/lib/utils.ts";
import { getClassStatusMeta } from "@/lib/class-status.ts";

type ClassStatusBadgeProps = {
  status: string | null | undefined;
  className?: string;
};

export function ClassStatusBadge({ status, className }: ClassStatusBadgeProps) {
  const meta = getClassStatusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-sm font-medium whitespace-nowrap",
        meta.labelClassName,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClassName)} />
      {meta.label}
    </span>
  );
}

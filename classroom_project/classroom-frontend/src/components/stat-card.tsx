import { MoreVertical } from "lucide-react";
import { useLink } from "@refinedev/core";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";

// Same label/value type scale as the dashboard's KpiCard, deliberately
// without its trend arrow or CSV export - there's no "vs last month"
// baseline for a department-scoped count anywhere in this app, and building
// one would be a new metrics feature, not a presentation match.
type StatCardProps = {
  label: string;
  value: number;
  isLoading?: boolean;
  viewAllHref: string;
};

export function StatCard({ label, value, isLoading, viewAllHref }: StatCardProps) {
  const Link = useLink();

  return (
    <Card className="shadow-none">
      <CardContent className="py-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium">{label}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 -mt-1 -mr-1"
                aria-label={`Options for ${label}`}
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={viewAllHref}>View all</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading ? (
          <Skeleton className="mt-2 h-9 w-16" />
        ) : (
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
            {value.toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

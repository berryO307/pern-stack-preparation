import { ArrowDown, ArrowUp, Minus, MoreVertical, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { cn } from "@/lib/utils.ts";
import type { DashboardKpi } from "@/types";

type KpiCardProps = {
  label: string;
  kpi?: DashboardKpi;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  viewAllHref: string;
};

export function KpiCard({ label, kpi, isLoading, isError, onRetry, viewAllHref }: KpiCardProps) {
  return (
    <Card className="shadow-none">
      <CardContent className="py-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 -mt-1 -mr-1"
                aria-label={`${label} options`}
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href={viewAllHref}>View all</a>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (!kpi) return;
                  const csv = `label,value,previous,deltaPct\n${label},${kpi.value},${kpi.previous},${kpi.deltaPct ?? ""}`;
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${label.toLowerCase()}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                disabled={!kpi}
              >
                Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading && (
          <div className="mt-2 space-y-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        )}

        {!isLoading && isError && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load</p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && kpi && (
          <>
            <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
              {kpi.value.toLocaleString()}
            </p>
            {kpi.previous > 0 && (
              <div className="mt-1 flex items-center gap-1 text-sm">
                {kpi.deltaPct === 0 ? (
                  <Minus className="size-4 text-muted-foreground" />
                ) : (kpi.deltaPct ?? 0) > 0 ? (
                  <ArrowUp className="size-4 text-emerald-600" />
                ) : (
                  <ArrowDown className="size-4 text-rose-600" />
                )}
                <span
                  className={cn(
                    "font-medium",
                    kpi.deltaPct === 0
                      ? "text-muted-foreground"
                      : (kpi.deltaPct ?? 0) > 0
                        ? "text-emerald-600"
                        : "text-rose-600",
                  )}
                >
                  {Math.abs(kpi.deltaPct ?? 0)}%
                </span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

KpiCard.displayName = "KpiCard";

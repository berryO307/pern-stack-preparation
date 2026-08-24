import { ArrowDown, ArrowUp, ArrowUpRight, Minus, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router";
import { Card, CardAction, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { cn } from "@/lib/utils.ts";
import type { DashboardKpi } from "@/types";

type KpiCardProps = {
  label: string;
  kpi?: DashboardKpi;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  viewAllHref: string;
  // Carried as router state rather than a `?filters[...]` query string - a
  // filter already present in the URL at mount is what breaks pagination on
  // the destination list page (see UsersList), so the scope is applied via
  // a normal post-mount filter change instead, same as a user picking it
  // from the Filters popover themselves.
  viewAllState?: Record<string, unknown>;
};

export function KpiCard({ label, kpi, isLoading, isError, onRetry, viewAllHref, viewAllState }: KpiCardProps) {
  const navigate = useNavigate();

  const goToList = () => navigate(viewAllHref, { state: viewAllState });

  const exportCsv = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (!kpi) return;
    const csv = `label,value,previous,deltaPct\n${label},${kpi.value},${kpi.previous},${kpi.deltaPct ?? ""}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <Card
      className="shadow-none cursor-pointer transition-colors hover:bg-muted/50"
      role="link"
      tabIndex={0}
      aria-label={`View all ${label.toLowerCase()}`}
      onClick={goToList}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToList();
        }
      }}
    >
      <CardContent className="py-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <CardAction>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 -mt-1 -mr-1"
                    disabled={!kpi}
                    onClick={exportCsv}
                  >
                    <ArrowUpRight className="size-4" />
                    <span className="sr-only">Export {label} as CSV</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export CSV</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardAction>
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
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onRetry(); }}>
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
            {/* Always rendered, even with no delta to show - a card whose
                delta row simply doesn't exist sits shorter than its
                siblings, and a row of four cards with one short leg reads
                as a rendering fault rather than "this one has no history
                yet". */}
            <div className="mt-1 flex items-center gap-1 text-sm">
              {kpi.previous > 0 ? (
                <>
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
                </>
              ) : (
                <span className="text-muted-foreground">No prior data</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

KpiCard.displayName = "KpiCard";

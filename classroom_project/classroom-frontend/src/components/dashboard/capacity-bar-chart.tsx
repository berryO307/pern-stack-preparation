import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { ArrowUpRight } from "lucide-react";
import { useLink } from "@refinedev/core";
import { useNavigate } from "react-router";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart.tsx";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion.ts";
import type { CapacityBucket } from "@/types";

// Fullest first, top to bottom - ordinal data in an ordinal layout, so the
// eye reads it as a ranking rather than having to hunt for the biggest arc
// in a donut.
const BUCKET_ORDER: CapacityBucket["bucket"][] = ["81-100", "61-80", "41-60", "21-40", "0-20"];

const chartConfig = {
  classes: { label: "Classes", color: "var(--chart-1)" },
} satisfies ChartConfig;

const bucketHref = (bucket: string) =>
  `/classes?filters[0][field]=capacityBucket&filters[0][operator]=eq&filters[0][value]=${bucket}`;

type BarDatum = { bucket: string; label: string; classes: number; pct: number; trailing: string };

type CapacityBarChartProps = {
  data?: CapacityBucket[];
  capacityExcluded?: number;
  isLoading: boolean;
};

export function CapacityBarChart({ data, capacityExcluded = 0, isLoading }: CapacityBarChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const Link = useLink();
  const navigate = useNavigate();

  const totalClasses = useMemo(
    () => (data ?? []).reduce((sum, d) => sum + d.classes, 0),
    [data],
  );

  const chartData = useMemo<BarDatum[]>(() => {
    if (!data) return [];
    const byBucket = new Map(data.map((d) => [d.bucket, d.classes]));
    return BUCKET_ORDER.map((bucket) => {
      const classes = byBucket.get(bucket) ?? 0;
      const pct = totalClasses > 0 ? Math.round((classes / totalClasses) * 100) : 0;
      // Percentage only, not "count · pct%" - the combined string's widest
      // case ("21 · 100%") could run past the 56px reserved for it, which is
      // what broke on a phone's narrower card (the label spilling past the
      // bar/card edge instead of sitting cleanly beside it). The count is
      // still one tap away via the tooltip and in the sr-only table below.
      return { bucket, label: `${bucket}%`, classes, pct, trailing: `${pct}%` };
    });
  }, [data, totalClasses]);

  const hasData = totalClasses > 0;

  const ariaLabel = hasData
    ? `Capacity distribution across ${totalClasses} classes, fullest first: ${chartData
        .map((d) => `${d.bucket}% full, ${d.classes} classes, ${d.pct}%`)
        .join("; ")}${capacityExcluded > 0 ? `; ${capacityExcluded} classes excluded, no capacity set` : ""}`
    : "No capacity data available";

  return (
    <Card className="shadow-none flex h-full min-w-0 flex-col">
      <CardHeader>
        <CardTitle>Capacity distribution</CardTitle>
        <p className="text-sm text-muted-foreground">
          How full each class is, by share of seats taken.
        </p>
        {hasData && (
          <CardAction>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7" asChild>
                    <Link to="/classes?sorters[0][field]=fillRate&sorters[0][order]=desc">
                      <ArrowUpRight className="size-4" />
                      <span className="sr-only">View full report</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View full report</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {isLoading ? (
          <div className="flex h-64 flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : !hasData ? (
          <div className="flex h-64 flex-1 flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">
              No capacity data yet — set seat counts on your classes to see this breakdown.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/classes">Go to Classes</Link>
            </Button>
          </div>
        ) : (
          <div role="img" aria-label={ariaLabel} className="flex flex-1 flex-col">
            <ChartContainer config={chartConfig} className="h-64 w-full flex-1">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 4, right: 40, top: 4, bottom: 4 }}
                accessibilityLayer
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" hide domain={[0, "dataMax"]} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(_value, _name, item) => {
                        const d = item.payload as BarDatum;
                        return (
                          <span>
                            <span className="font-medium text-foreground">{d.bucket}% full</span>
                            {" — "}
                            <span className="tabular-nums">{d.classes}</span> class{d.classes === 1 ? "" : "es"} ·{" "}
                            <span className="tabular-nums">{d.pct}%</span>
                          </span>
                        );
                      }}
                    />
                  }
                />
                <Bar
                  dataKey="classes"
                  radius={4}
                  maxBarSize={28}
                  isAnimationActive={!prefersReducedMotion}
                  className="cursor-pointer"
                  onClick={(entry: unknown) => {
                    const bucket = (entry as { bucket?: string } | undefined)?.bucket;
                    if (bucket) navigate(bucketHref(bucket));
                  }}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.bucket} fill="var(--chart-1)" />
                  ))}
                  <LabelList
                    dataKey="trailing"
                    position="right"
                    className="fill-foreground tabular-nums"
                    fontSize={12}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>

            <table className="sr-only">
              <caption>Capacity distribution</caption>
              <thead>
                <tr>
                  <th>Fill rate</th>
                  <th>Classes</th>
                  <th>Share of total</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((entry) => (
                  <tr key={entry.bucket}>
                    <td>{entry.bucket}%</td>
                    <td>{entry.classes}</td>
                    <td>{entry.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {hasData && capacityExcluded > 0 && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            <span className="tabular-nums">{capacityExcluded}</span> class{capacityExcluded === 1 ? " has" : "es have"} no capacity set —{" "}
            <Link to="/classes" className="underline underline-offset-2 hover:text-foreground">
              fix them
            </Link>
            .
          </p>
        </CardContent>
      )}
    </Card>
  );
}

CapacityBarChart.displayName = "CapacityBarChart";

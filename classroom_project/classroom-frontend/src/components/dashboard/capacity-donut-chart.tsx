import { useMemo } from "react";
import { Pie, PieChart, Cell } from "recharts";
import { useLink } from "@refinedev/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart.tsx";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion.ts";
import type { CapacityBucket } from "@/types";

const BUCKET_ORDER: CapacityBucket["bucket"][] = ["81-100", "61-80", "41-60", "21-40", "0-20"];
const BUCKET_COLOR: Record<string, string> = {
  "81-100": "var(--chart-1)",
  "61-80": "var(--chart-2)",
  "41-60": "var(--chart-3)",
  "21-40": "var(--chart-4)",
  "0-20": "var(--chart-5)",
};

const chartConfig = {
  classes: { label: "Classes" },
} satisfies ChartConfig;

type CapacityDonutChartProps = {
  data?: CapacityBucket[];
  isLoading: boolean;
};

export function CapacityDonutChart({ data, isLoading }: CapacityDonutChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const Link = useLink();

  const orderedData = useMemo(() => {
    if (!data) return [];
    const byBucket = new Map(data.map((d) => [d.bucket, d.classes]));
    return BUCKET_ORDER.map((bucket) => ({ bucket, classes: byBucket.get(bucket) ?? 0 }));
  }, [data]);

  const totalClasses = useMemo(
    () => orderedData.reduce((sum, d) => sum + d.classes, 0),
    [orderedData],
  );

  const hasData = totalClasses > 0;

  const ariaLabel = hasData
    ? `Capacity distribution across ${totalClasses} classes: ${orderedData
        .map((d) => `${d.bucket}% full, ${d.classes} classes`)
        .join("; ")}`
    : "No capacity data available";

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Capacity distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : !hasData ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">
              No capacity data yet — set seat counts on your classes to see this breakdown.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/classes">Go to Classes</Link>
            </Button>
          </div>
        ) : (
          <div role="img" aria-label={ariaLabel} className="flex items-center gap-4">
            <div className="relative size-44 shrink-0">
              <ChartContainer config={chartConfig} className="size-44 aspect-square">
                <PieChart accessibilityLayer>
                  <Pie
                    data={orderedData}
                    dataKey="classes"
                    nameKey="bucket"
                    innerRadius="62%"
                    outerRadius="92%"
                    paddingAngle={2}
                    strokeWidth={0}
                    isAnimationActive={!prefersReducedMotion}
                  >
                    {orderedData.map((entry) => (
                      <Cell key={entry.bucket} fill={BUCKET_COLOR[entry.bucket]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold tabular-nums">{totalClasses}</span>
                <span className="text-xs text-muted-foreground">classes</span>
              </div>
            </div>

            <div className="flex-1 space-y-1.5">
              {orderedData.map((entry) => (
                <div key={entry.bucket} className="flex items-center gap-2 text-xs">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: BUCKET_COLOR[entry.bucket] }}
                  />
                  <span className="text-muted-foreground">{entry.bucket}%</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">{entry.classes}</span>
                </div>
              ))}
            </div>

            <table className="sr-only">
              <caption>Capacity distribution</caption>
              <thead>
                <tr>
                  <th>Fill rate</th>
                  <th>Classes</th>
                </tr>
              </thead>
              <tbody>
                {orderedData.map((entry) => (
                  <tr key={entry.bucket}>
                    <td>{entry.bucket}%</td>
                    <td>{entry.classes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {hasData && (
        <CardContent className="pt-0">
          <Button variant="outline" size="sm" asChild>
            <Link to="/classes?sorters[0][field]=fillRate&sorters[0][order]=desc">View full report</Link>
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

CapacityDonutChart.displayName = "CapacityDonutChart";

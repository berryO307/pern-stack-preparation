import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useList } from "@refinedev/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion.ts";
import type { Department, FillRatePoint } from "@/types";

const chartConfig = {
  selected: { label: "Your department", color: "var(--chart-1)" },
  institution: { label: "Institution average", color: "var(--chart-3)" },
} satisfies ChartConfig;

type FillRateTrendChartProps = {
  data?: FillRatePoint[];
  isLoading: boolean;
  selectedDepartmentId?: number;
  onDepartmentChange: (departmentId: number) => void;
};

export function FillRateTrendChart({
  data,
  isLoading,
  selectedDepartmentId,
  onDepartmentChange,
}: FillRateTrendChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const { query: departmentsQuery } = useList<Department>({
    resource: "departments",
    pagination: { pageSize: 100 },
  });
  const departments = departmentsQuery.data?.data ?? [];
  const selectedDepartmentName = departments.find((d) => d.id === selectedDepartmentId)?.name;

  const chartData = useMemo(
    () =>
      (data ?? []).map((point) => ({
        ...point,
        monthLabel: formatMonthLabel(point.month),
      })),
    [data],
  );

  const ariaLabel = chartData.length
    ? `Average class fill rate by month, ${chartData[0]?.monthLabel} through ${chartData[chartData.length - 1]?.monthLabel}: ${chartData
        .map(
          (d) =>
            `${d.monthLabel}: your department ${d.selected ?? "no data"}%, institution ${d.institution ?? "no data"}%`,
        )
        .join("; ")}`
    : "No fill rate data available";

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Average class fill rate</CardTitle>
          <p className="text-sm text-muted-foreground">
            Compare a department against the institution average.
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Select
                value={selectedDepartmentId?.toString()}
                onValueChange={(value) => onDepartmentChange(Number(value))}
              >
                <SelectTrigger className="w-44" size="sm">
                  <SelectValue placeholder="Department" className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id.toString()}>
                      <span className="truncate">{department.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TooltipTrigger>
            {selectedDepartmentName && (
              <TooltipContent>{selectedDepartmentName}</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <div role="img" aria-label={ariaLabel}>
            <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
              <AreaChart data={chartData} margin={{ left: 4, right: 12, bottom: 8 }} accessibilityLayer>
                <defs>
                  <linearGradient id="fillSelected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  label={{ value: "Month", position: "insideBottom", offset: -8, fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  label={{
                    value: "Fill rate %",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 11,
                  }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend
                  verticalAlign="top"
                  align="right"
                  content={<ChartLegendContent />}
                />
                <Area
                  dataKey="institution"
                  type="monotone"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  fill="none"
                  dot={false}
                  connectNulls
                  isAnimationActive={!prefersReducedMotion}
                />
                <Area
                  dataKey="selected"
                  type="monotone"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#fillSelected)"
                  dot={false}
                  connectNulls
                  isAnimationActive={!prefersReducedMotion}
                />
              </AreaChart>
            </ChartContainer>

            <table className="sr-only">
              <caption>Average class fill rate by month</caption>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Your department</th>
                  <th>Institution average</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((point) => (
                  <tr key={point.month}>
                    <td>{point.monthLabel}</td>
                    <td>{point.selected ?? "No data"}</td>
                    <td>{point.institution ?? "No data"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatMonthLabel(month: string) {
  const [year, monthNum] = month.split("-");
  const date = new Date(Number(year), Number(monthNum) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short" });
}

FillRateTrendChart.displayName = "FillRateTrendChart";

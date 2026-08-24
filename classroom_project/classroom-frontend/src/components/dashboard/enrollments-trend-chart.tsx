import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { useList } from "@refinedev/core";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
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
import { cn } from "@/lib/utils.ts";
import type { Department, EnrollmentsPoint } from "@/types";

const chartConfig = {
  count: { label: "Enrollments", color: "var(--chart-1)" },
} satisfies ChartConfig;

type EnrollmentsTrendChartProps = {
  data?: EnrollmentsPoint[];
  total12mo?: number;
  deltaPct?: number | null;
  isLoading: boolean;
  selectedDepartmentId?: number | "all";
  onDepartmentChange: (departmentId: number | "all") => void;
};

export function EnrollmentsTrendChart({
  data,
  total12mo = 0,
  deltaPct,
  isLoading,
  selectedDepartmentId,
  onDepartmentChange,
}: EnrollmentsTrendChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const { query: departmentsQuery } = useList<Department>({
    resource: "departments",
    pagination: { pageSize: 100 },
  });
  const departments = departmentsQuery.data?.data ?? [];
  const isAllDepartments = selectedDepartmentId === "all";
  const selectedDepartmentName = isAllDepartments
    ? "All departments"
    : departments.find((d) => d.id === selectedDepartmentId)?.name;

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const years = new Set(data.map((point) => point.month.split("-")[0]));
    const spansYears = years.size > 1;
    const yearTotal = data.reduce((sum, p) => sum + p.count, 0);
    return data.map((point) => ({
      ...point,
      monthLabel: formatMonthLabel(point.month, spansYears),
      sharePct: yearTotal > 0 ? Math.round((point.count / yearTotal) * 100) : 0,
    }));
  }, [data]);

  const hasHistory = chartData.some((point) => point.count > 0);

  // A one-line plain-language reading, same spirit as the fill-rate chart's
  // caption it replaces - the peak month is the one genuinely useful fact a
  // reader takes from a bar chart shaped by real seasonality.
  const peakCaption = useMemo(() => {
    if (chartData.length === 0) return null;
    const peak = chartData.reduce((max, p) => (p.count > max.count ? p : max), chartData[0]!);
    if (peak.count === 0) return null;
    return `${peak.monthLabel} was the busiest month${isAllDepartments ? "" : ` for ${selectedDepartmentName}`}, with ${peak.count} new enrollment${peak.count === 1 ? "" : "s"}.`;
  }, [chartData, isAllDepartments, selectedDepartmentName]);

  const ariaLabel = chartData.length
    ? `New enrollments by month, ${chartData[0]?.monthLabel} through ${chartData[chartData.length - 1]?.monthLabel}: ${chartData
        .map((d) => `${d.monthLabel}: ${d.count}`)
        .join("; ")}`
    : "No enrollment data available";

  return (
    <Card className="shadow-none flex h-full flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Enrollments</CardTitle>
          <p className="text-sm text-muted-foreground">New enrollments per month.</p>
        </div>
        <Select
          value={selectedDepartmentId?.toString()}
          onValueChange={(value) => onDepartmentChange(value === "all" ? "all" : Number(value))}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <SelectTrigger className="w-44" size="sm">
                  <SelectValue placeholder="Department" className="truncate" />
                </SelectTrigger>
              </TooltipTrigger>
              {selectedDepartmentName && (
                <TooltipContent>{selectedDepartmentName}</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <SelectContent>
            <SelectItem value="all">
              <span className="truncate">All departments</span>
            </SelectItem>
            {departments.map((department) => (
              <SelectItem key={department.id} value={department.id.toString()}>
                <span className="truncate">{department.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {isLoading ? (
          <div className="flex h-64 flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">
                {total12mo.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">enrollments in the last 12 months</span>
              {deltaPct != null && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-sm font-medium",
                    deltaPct === 0
                      ? "text-muted-foreground"
                      : deltaPct > 0
                        ? "text-emerald-600"
                        : "text-rose-600",
                  )}
                >
                  {deltaPct === 0 ? (
                    <Minus className="size-4" />
                  ) : deltaPct > 0 ? (
                    <ArrowUp className="size-4" />
                  ) : (
                    <ArrowDown className="size-4" />
                  )}
                  {Math.abs(deltaPct)}% vs the prior 12
                </span>
              )}
            </div>

            {!hasHistory ? (
              <div className="flex h-64 flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center">
                <p className="text-sm text-muted-foreground">
                  No enrollment history for {selectedDepartmentName ?? "this department"} yet.
                </p>
              </div>
            ) : (
              <div role="img" aria-label={ariaLabel} className="flex flex-1 flex-col">
                <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                  <LineChart data={chartData} margin={{ left: 4, right: 12, top: 8, bottom: 4 }} accessibilityLayer>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={32}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => v.toLocaleString()}
                    />
                    <ChartTooltip
                      cursor={{ stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "3 3" }}
                      content={
                        <ChartTooltipContent
                          hideLabel
                          formatter={(_value, _name, item) => {
                            const d = item.payload as (typeof chartData)[number];
                            return (
                              <span>
                                <span className="font-medium text-foreground">{d.monthLabel}</span>
                                {" — "}
                                <span className="tabular-nums">{d.count}</span> enrollment{d.count === 1 ? "" : "s"} ·{" "}
                                <span className="tabular-nums">{d.sharePct}%</span> of the year
                              </span>
                            );
                          }}
                        />
                      }
                    />
                    <Line
                      dataKey="count"
                      type="monotone"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                      isAnimationActive={!prefersReducedMotion}
                    />
                  </LineChart>
                </ChartContainer>

                <table className="sr-only">
                  <caption>New enrollments by month</caption>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Enrollments</th>
                      <th>Share of year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((point) => (
                      <tr key={point.month}>
                        <td>{point.monthLabel}</td>
                        <td>{point.count}</td>
                        <td>{point.sharePct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {peakCaption && (
                  <p className="mt-3 text-sm text-muted-foreground">{peakCaption}</p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function formatMonthLabel(month: string, includeYear: boolean) {
  const [year, monthNum] = month.split("-");
  const date = new Date(Number(year), Number(monthNum) - 1, 1);
  return date.toLocaleDateString("en-US", {
    month: "short",
    ...(includeYear && { year: "numeric" })
  });
}

EnrollmentsTrendChart.displayName = "EnrollmentsTrendChart";

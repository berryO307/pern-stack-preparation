import { useCustom } from "@refinedev/core";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  BookOpen,
  Building2,
  GaugeCircle,
  GraduationCap,
  School,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { BACKEND_BASE_URL } from "@/constants";
import type { DashboardData } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  low: "var(--muted-foreground)",
  medium: "var(--chart-1)",
  high: "var(--color-amber-500, #f59e0b)",
  full: "var(--destructive)",
};

const ROLE_COLORS: Record<string, string> = {
  student: "var(--chart-1)",
  teacher: "var(--chart-3)",
  admin: "var(--chart-5)",
};

const enrollmentChartConfig = {
  count: { label: "Enrollments", color: "var(--chart-1)" },
} satisfies ChartConfig;

const classesByDeptChartConfig = {
  count: { label: "Classes", color: "var(--chart-1)" },
} satisfies ChartConfig;

const capacityChartConfig = {
  count: { label: "Classes" },
  low: { label: "Under 50%", color: STATUS_COLORS.low },
  medium: { label: "50-79%", color: STATUS_COLORS.medium },
  high: { label: "80-99%", color: STATUS_COLORS.high },
  full: { label: "Full", color: STATUS_COLORS.full },
} satisfies ChartConfig;

const roleChartConfig = {
  count: { label: "Users" },
  student: { label: "Student", color: ROLE_COLORS.student },
  teacher: { label: "Teacher", color: ROLE_COLORS.teacher },
  admin: { label: "Admin", color: ROLE_COLORS.admin },
} satisfies ChartConfig;

const ACTIVITY_ICON = {
  enrollment: UserPlus,
  class: BookOpen,
  user: GraduationCap,
} as const;

type MetricCardProps = {
  label: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
};

const MetricCard = ({ label, value, description, icon: Icon }: MetricCardProps) => (
  <Card>
    <CardContent className="flex items-center gap-4 py-2">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-tight">{value}</p>
        <p className="text-sm text-muted-foreground truncate">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground/80">{description}</p>
        )}
      </div>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const { query } = useCustom<DashboardData>({
    url: `${BACKEND_BASE_URL}dashboard`,
    method: "get",
  });

  const data = query.data?.data;
  const { isLoading, isError } = query;

  if (isLoading || isError || !data) {
    return (
      <div className="class-view">
        <h1 className="page-title">Dashboard</h1>
        <p className="state-message">
          {isLoading
            ? "Loading dashboard..."
            : "Failed to load dashboard data."}
        </p>
      </div>
    );
  }

  const { metrics, enrollmentTrends, classesByDepartment, capacityStatus, userDistribution, activity } = data;

  return (
    <div className="class-view space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of departments, classes, and enrollments.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Students" value={metrics.totalStudents} icon={GraduationCap} />
        <MetricCard label="Teachers" value={metrics.totalTeachers} icon={School} />
        <MetricCard label="Admins" value={metrics.totalAdmins} icon={ShieldCheck} />
        <MetricCard label="Departments" value={metrics.totalDepartments} icon={Building2} />
        <MetricCard
          label="Classes"
          value={metrics.totalClasses}
          description={`${metrics.activeClasses} active`}
          icon={BookOpen}
        />
        <MetricCard
          label="Capacity Filled"
          value={`${metrics.capacityUtilization}%`}
          description={`${metrics.totalEnrollments}/${metrics.totalCapacity} seats`}
          icon={GaugeCircle}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enrollment Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={enrollmentChartConfig} className="aspect-auto h-64 w-full">
              <AreaChart data={enrollmentTrends} margin={{ left: 0, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={(value) => format(parseISO(value), "MMM d")}
                />
                <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => format(parseISO(value as string), "MMM d, yyyy")}
                    />
                  }
                />
                <Area
                  dataKey="count"
                  type="monotone"
                  fill="var(--color-count)"
                  fillOpacity={0.2}
                  stroke="var(--color-count)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={roleChartConfig} className="aspect-auto h-64 w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={userDistribution}
                  dataKey="count"
                  nameKey="role"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {userDistribution.map((entry) => (
                    <Cell key={entry.role} fill={ROLE_COLORS[entry.role]} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="role" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Classes by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={classesByDeptChartConfig} className="aspect-auto h-64 w-full">
              <BarChart data={classesByDepartment} margin={{ left: 0, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="department"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capacity Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={capacityChartConfig} className="aspect-auto h-64 w-full">
              <BarChart data={capacityStatus} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={4}>
                  {capacityStatus.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {activity.map((item, index) => {
                const Icon = ACTIVITY_ICON[item.type];
                return (
                  <div key={`${item.type}-${index}`} className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{item.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {item.type}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;

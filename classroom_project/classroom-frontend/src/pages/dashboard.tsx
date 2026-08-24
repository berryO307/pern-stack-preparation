import { Suspense, lazy, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { DashboardHeader } from "@/components/dashboard/dashboard-header.tsx";
import { QuickCreateSection } from "@/components/dashboard/quick-create-section.tsx";
import { KpiCards } from "@/components/dashboard/kpi-cards.tsx";
import { RecentActivity } from "@/components/dashboard/recent-activity.tsx";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary.ts";

// Recharts is a meaningful chunk of weight the initial dashboard load doesn't
// need — split it out so it's fetched only once these cards are about to render.
const CapacityBarChart = lazy(() =>
  import("@/components/dashboard/capacity-bar-chart.tsx").then((m) => ({
    default: m.CapacityBarChart,
  })),
);
const EnrollmentsTrendChart = lazy(() =>
  import("@/components/dashboard/enrollments-trend-chart.tsx").then((m) => ({
    default: m.EnrollmentsTrendChart,
  })),
);

const ChartSkeleton = () => <Skeleton className="h-full min-h-[320px] w-full" />;

const DEPARTMENT_SESSION_KEY = "dashboard.enrollmentsTrend.departmentId";

const Dashboard = () => {
  const [departmentId, setDepartmentId] = useState<number | "all" | undefined>(() => {
    const stored = sessionStorage.getItem(DEPARTMENT_SESSION_KEY);
    if (stored === "all") return "all";
    const parsed = Number(stored);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  });
  const { data, isLoading, isError, refetch } = useDashboardSummary(departmentId);
  const summary = data?.data;

  // Seed the department picker from the server's "largest department" default,
  // once, the first time we learn it — never overrides a user's own choice
  // (including a choice already restored from this session's storage).
  useEffect(() => {
    if (departmentId === undefined && summary?.enrollmentsDepartmentId) {
      setDepartmentId(summary.enrollmentsDepartmentId);
    }
  }, [departmentId, summary?.enrollmentsDepartmentId]);

  const handleDepartmentChange = (next: number | "all") => {
    setDepartmentId(next);
    sessionStorage.setItem(DEPARTMENT_SESSION_KEY, String(next));
  };

  return (
    <div className="class-view space-y-6">
      <DashboardHeader />
      <QuickCreateSection />

      <KpiCards
        kpis={summary?.kpis}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />

      {/* items-stretch (grid's default) equalises the two cards' heights -
          each Card fills its row via h-full/flex-1 internally. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Suspense fallback={<ChartSkeleton />}>
          <CapacityBarChart
            data={summary?.capacityDistribution}
            capacityExcluded={summary?.capacityExcluded}
            isLoading={isLoading}
          />
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          <EnrollmentsTrendChart
            data={summary?.enrollmentsTrend}
            total12mo={summary?.enrollmentsTotal12mo}
            deltaPct={summary?.enrollmentsDeltaPct}
            isLoading={isLoading}
            selectedDepartmentId={departmentId}
            onDepartmentChange={handleDepartmentChange}
          />
        </Suspense>
      </div>

      <RecentActivity activity={summary?.recentActivity ?? []} isLoading={isLoading} />
    </div>
  );
};

export default Dashboard;

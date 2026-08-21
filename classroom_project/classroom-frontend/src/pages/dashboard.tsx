import { Suspense, lazy, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { DashboardHeader } from "@/components/dashboard/dashboard-header.tsx";
import { QuickCreateSection } from "@/components/dashboard/quick-create-section.tsx";
import { KpiCards } from "@/components/dashboard/kpi-cards.tsx";
import { RecentActivity } from "@/components/dashboard/recent-activity.tsx";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary.ts";

// Recharts is a meaningful chunk of weight the initial dashboard load doesn't
// need — split it out so it's fetched only once these cards are about to render.
const CapacityDonutChart = lazy(() =>
  import("@/components/dashboard/capacity-donut-chart.tsx").then((m) => ({
    default: m.CapacityDonutChart,
  })),
);
const FillRateTrendChart = lazy(() =>
  import("@/components/dashboard/fill-rate-trend-chart.tsx").then((m) => ({
    default: m.FillRateTrendChart,
  })),
);

const ChartSkeleton = () => <Skeleton className="h-64 w-full" />;

const Dashboard = () => {
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined);
  const { data, isLoading, isError, refetch } = useDashboardSummary(departmentId);
  const summary = data?.data;

  // Seed the department picker from the server's "largest department" default,
  // once, the first time we learn it — never overrides a user's own choice.
  useEffect(() => {
    if (departmentId === undefined && summary?.fillRateDepartmentId) {
      setDepartmentId(summary.fillRateDepartmentId);
    }
  }, [departmentId, summary?.fillRateDepartmentId]);

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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Suspense fallback={<ChartSkeleton />}>
          <CapacityDonutChart data={summary?.capacityDistribution} isLoading={isLoading} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          <FillRateTrendChart
            data={summary?.fillRateTrend}
            isLoading={isLoading}
            selectedDepartmentId={departmentId}
            onDepartmentChange={setDepartmentId}
          />
        </Suspense>
      </div>

      <RecentActivity activity={summary?.recentActivity ?? []} isLoading={isLoading} />
    </div>
  );
};

export default Dashboard;

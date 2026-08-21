import { KpiCard } from "@/components/dashboard/kpi-card.tsx";
import type { DashboardSummary } from "@/types";

type KpiCardsProps = {
  kpis?: DashboardSummary["kpis"];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

export function KpiCards({ kpis, isLoading, isError, onRetry }: KpiCardsProps) {
  const cards = [
    {
      key: "students",
      label: "Total students",
      kpi: kpis?.students,
      href: "/users?filters[0][field]=role&filters[0][operator]=eq&filters[0][value]=student",
    },
    { key: "faculty", label: "Faculty", kpi: kpis?.faculty, href: "/faculty" },
    { key: "classes", label: "Classes", kpi: kpis?.classes, href: "/classes" },
    { key: "subjects", label: "Subjects", kpi: kpis?.subjects, href: "/subjects" },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <KpiCard
          key={card.key}
          label={card.label}
          kpi={card.kpi}
          isLoading={isLoading}
          isError={isError}
          onRetry={onRetry}
          viewAllHref={card.href}
        />
      ))}
    </div>
  );
}

KpiCards.displayName = "KpiCards";

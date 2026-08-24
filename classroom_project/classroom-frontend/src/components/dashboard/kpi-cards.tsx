import { useNavigation } from "@refinedev/core";
import { KpiCard } from "@/components/dashboard/kpi-card.tsx";
import type { DashboardSummary } from "@/types";

type KpiCardsProps = {
  kpis?: DashboardSummary["kpis"];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

export function KpiCards({ kpis, isLoading, isError, onRetry }: KpiCardsProps) {
  // Base paths come from the resources Refine already knows about, not
  // hand-typed strings - if a list route ever moves, these move with it.
  // The students card's role scope travels as router state (see KpiCard),
  // not a `?filters[...]` query string - a filter baked into the URL at
  // mount is what breaks Next/Filters on the destination page.
  const { listUrl } = useNavigation();

  const cards = [
    {
      key: "students",
      label: "Total students",
      kpi: kpis?.students,
      href: listUrl("users"),
      state: { presetRole: "student" },
    },
    { key: "faculty", label: "Faculty", kpi: kpis?.faculty, href: listUrl("faculty") },
    { key: "classes", label: "Classes", kpi: kpis?.classes, href: listUrl("classes") },
    { key: "subjects", label: "Subjects", kpi: kpis?.subjects, href: listUrl("subjects") },
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
          viewAllState={"state" in card ? card.state : undefined}
        />
      ))}
    </div>
  );
}

KpiCards.displayName = "KpiCards";

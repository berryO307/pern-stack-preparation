import { useGetIdentity } from "@refinedev/core";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { CsvImportDialog } from "@/components/dashboard/csv-import-dialog.tsx";
import { useIsAdmin } from "@/hooks/use-is-admin.ts";
import { displayName } from "@/lib/utils.ts";

type Identity = { name?: string; fullName?: string; email?: string };

export function DashboardHeader() {
  const { data: identity, isLoading } = useGetIdentity<Identity>();
  const { isAdmin } = useIsAdmin();

  const firstName = displayName({
    name: identity?.fullName || identity?.name,
    email: identity?.email,
  }).split(" ")[0];

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {isLoading ? (
          <>
            <Skeleton className="h-9 w-64" />
            <Skeleton className="mt-2 h-4 w-80" />
          </>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">
              Welcome back{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              An overview of your departments, classes, faculty and enrollments.
            </p>
          </>
        )}
      </div>

      {isAdmin && (
        <div className="flex shrink-0 items-center gap-2">
          <CsvImportDialog />
        </div>
      )}
    </div>
  );
}

DashboardHeader.displayName = "DashboardHeader";

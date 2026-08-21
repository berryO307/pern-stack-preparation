import { useGetIdentity } from "@refinedev/core";
import { useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { CsvImportDialog } from "@/components/dashboard/csv-import-dialog.tsx";
import { useIsAdmin } from "@/hooks/use-is-admin.ts";

type Identity = { name?: string; fullName?: string };

export function DashboardHeader() {
  const { data: identity, isLoading } = useGetIdentity<Identity>();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  const firstName = (identity?.fullName || identity?.name || "").split(" ")[0];

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
              Track, manage and forecast departments, classes and enrollments.
            </p>
          </>
        )}
      </div>

      {isAdmin && (
        <div className="flex shrink-0 items-center gap-2">
          <CsvImportDialog />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="lg">
                <Plus className="size-4" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate("/subjects/create")}>
                Add subject
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/classes/create")}>
                Add class
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/departments/create")}>
                Add department
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/users/create?role=teacher")}>
                Add faculty
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

DashboardHeader.displayName = "DashboardHeader";

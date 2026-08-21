import { ListView } from "@/components/refine-ui/views/list-view.tsx";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb.tsx";
import { Search, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { useState, useMemo, useEffect, useRef } from "react";
import { useTable } from "@refinedev/react-table";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { DataTable } from "@/components/refine-ui/data-table/data-table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { DeleteButton } from "@/components/refine-ui/buttons/delete.tsx";
import { CreateButton } from "@/components/refine-ui/buttons/create.tsx";
import { Enrollment } from "@/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value.ts";
import { getFilterValue } from "@/lib/filters.ts";

const EnrollmentsList = () => {
  const EnrollmentsTable = useTable<Enrollment>({
    columns: useMemo<ColumnDef<Enrollment>[]>(
      () => [
        {
          id: "student",
          size: 220,
          header: () => <p className="column-title ml-2">Student</p>,
          cell: ({ row }) => (
            <div className="min-w-0 ml-2">
              <p className="truncate text-foreground">{row.original.student?.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.original.student?.email}
              </p>
            </div>
          ),
        },
        {
          id: "class",
          size: 200,
          header: () => <p className="column-title">Class</p>,
          cell: ({ row }) => (
            <span className="text-foreground truncate">{row.original.class?.name}</span>
          ),
        },
        {
          id: "subject",
          size: 160,
          header: () => <p className="column-title">Subject</p>,
          cell: ({ row }) => {
            const subject = row.original.class?.subject;
            return subject ? (
              <Badge variant="secondary">{subject.code}</Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
        },
        {
          id: "createdAt",
          accessorKey: "createdAt",
          size: 160,
          header: () => <p className="column-title">Enrolled</p>,
          cell: ({ getValue }) => {
            const value = getValue<string>();
            return (
              <span className="text-muted-foreground">
                {value ? format(new Date(value), "MMM d, yyyy") : "—"}
              </span>
            );
          },
        },
        {
          id: "actions",
          size: 140,
          header: () => <p className="column-title">Actions</p>,
          cell: ({ row }) => (
            <DeleteButton resource="enrollments" recordItemId={row.original.id} size="sm">
              Unenroll
            </DeleteButton>
          ),
        },
      ],
      [],
    ),
    refineCoreProps: {
      resource: "enrollments",
      pagination: { pageSize: 10, mode: "server" },
      filters: {
        defaultBehavior: "replace",
      },
      sorters: {
        initial: [{ field: "createdAt", order: "desc" }],
      },
      syncWithLocation: true,
    },
  });

  const { filters, setFilters } = EnrollmentsTable.refineCore;

  const [searchQuery, setSearchQuery] = useState(() => getFilterValue(filters, "search"));
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setFilters(
      debouncedSearch
        ? [{ field: "search", operator: "contains", value: debouncedSearch }]
        : [],
      "replace",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Keeps the search control in sync when `filters` changes from
  // outside this component's own debounced push above — browser back/forward
  // navigation, or an external link landing on this page with a filter set.
  useEffect(() => {
    setSearchQuery(getFilterValue(filters, "search"));
  }, [filters]);

  return (
    <ListView>
      <Breadcrumb />

      <h1 className="page-title">Enrollments</h1>

      <div className="intro-row">
        <p>Every student-to-class enrollment across the institution.</p>

        <div className="actions-row">
          <div className="search-field">
            <Search className="search-icon" />
            <Input
              type="text"
              placeholder="Search by student or class..."
              className="pl-10 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <CreateButton resource="enrollments">
            <div className="flex items-center gap-2 font-semibold">
              <UserPlus className="w-4 h-4" />
              <span>Enroll Student</span>
            </div>
          </CreateButton>
        </div>
      </div>

      <DataTable table={EnrollmentsTable} />
    </ListView>
  );
};

export default EnrollmentsList;

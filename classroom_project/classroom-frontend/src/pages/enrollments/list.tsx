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
import { PersonCell } from "@/components/person-cell.tsx";
import { buildAvatarSrc } from "@/lib/cloudinary.ts";

const EnrollmentsList = () => {
  const EnrollmentsTable = useTable<Enrollment>({
    columns: useMemo<ColumnDef<Enrollment>[]>(
      () => [
        {
          id: "student",
          size: 240,
          header: () => <p className="column-title ml-2">Student</p>,
          cell: ({ row }) => {
            const student = row.original.student;
            if (!student) return <span className="ml-2 text-muted-foreground">—</span>;
            return (
              <div className="min-w-0 ml-2">
                <PersonCell
                  name={student.name}
                  avatarSrc={buildAvatarSrc(student.imageCldPubId, student.image)}
                />
                <p className="truncate text-xs text-muted-foreground mt-0.5 ml-10">
                  {student.email}
                </p>
              </div>
            );
          },
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
    // Below md the table scrolls horizontally inside its card rather than
    // collapsing into stacked cards - reuses DataTable's existing pinned-
    // column sticky logic so Student stays visible while scrolling right,
    // consistent with every other list page (Classes/Subjects/Users).
    initialState: {
      columnPinning: { left: ["student"] },
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

      <p className="text-sm text-muted-foreground">
        Every student-to-class enrollment across the institution.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="search-field sm:w-1/3">
          <Search className="search-icon" />
          <Input
            type="text"
            placeholder="Search by student or class..."
            className="pl-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
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

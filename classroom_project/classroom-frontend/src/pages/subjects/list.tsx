import { ListView } from "@/components/refine-ui/views/list-view.tsx";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb.tsx";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { useState, useMemo, useEffect, useRef } from "react";
import { useTable } from "@refinedev/react-table";
import { type ColumnDef } from "@tanstack/react-table";
import { useLink, useList, useNavigation } from "@refinedev/core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { CreateButton } from "@/components/refine-ui/buttons/create.tsx";
import { DataTable } from "@/components/refine-ui/data-table/data-table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { DepartmentBadge } from "@/components/department-badge.tsx";
import { Department, Subject } from "@/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value.ts";
import { getFilterValue } from "@/lib/filters.ts";

const SubjectsList = () => {
  const { query: departmentsQuery } = useList<Department>({
    resource: "departments",
    pagination: { pageSize: 100 },
  });
  const departments = departmentsQuery?.data?.data ?? [];

  const { showUrl } = useNavigation();
  const Link = useLink();

  const SubjectTable = useTable<Subject>({
    columns: useMemo<ColumnDef<Subject>[]>(
      () => [
        {
          id: "code",
          accessorKey: "code",
          meta: { flex: true, className: "w-[120px]" },
          header: () => (
            <p className="column-title w-full justify-center">Code</p>
          ),
          cell: ({ getValue }) => (
            <div className="flex w-full justify-center">
              <Badge>{getValue() as string}</Badge>
            </div>
          ),
        },
        {
          id: "name",
          accessorKey: "name",
          // Fixed and deterministic, not wider than it needs to be - this
          // column is pinned, so its width is what's permanently visible on
          // a narrow screen while the rest of the row scrolls underneath it.
          // 320px left almost nothing else on a phone; matches Classes'
          // pinned Name column width instead.
          meta: { flex: true, className: "w-[240px]" },
          header: () => <p className="column-title">Name</p>,
          cell: ({ getValue, row }) => (
            <Link
              to={showUrl("subjects", row.original.id)}
              className="font-medium text-foreground hover:underline"
            >
              {getValue<string>()}
            </Link>
          ),
        },
        {
          id: "department",
          accessorKey: "department.name",
          meta: { flex: true, className: "w-[260px]" },
          header: () => (
            <p className="column-title w-full justify-center">Department</p>
          ),
          cell: ({ getValue }) => (
            <div className="flex w-full justify-center">
              <DepartmentBadge name={getValue<string>()} />
            </div>
          ),
        },
        {
          id: "description",
          accessorKey: "description",
          // A fixed width via `w-`, not `min-w-` - table-layout:fixed (set
          // on the shared DataTable) only sizes a column from an explicit
          // `width`, never from `min-width`. A `min-w-` here was silently
          // collapsing this column to ~0 width instead of the intended
          // minimum, which is what made Description render blank on a
          // phone: the table scrolls horizontally instead of collapsing to
          // nothing, same as every other list page's fixed-width columns.
          meta: { flex: true, className: "w-[220px]" },
          header: () => <p className="column-title pl-8">Description</p>,
          cell: ({ getValue }) => (
            <span className="block truncate text-ellipsis whitespace-nowrap pl-8 pr-4 text-muted-foreground">
              {getValue<string>()}
            </span>
          ),
        },
      ],
      [],
    ),
    refineCoreProps: {
      resource: "subjects",
      pagination: { pageSize: 10, mode: "server" },
      filters: {
        defaultBehavior: "replace",
      },
      sorters: {
        initial: [{ field: "id", order: "desc" }],
      },
      syncWithLocation: true,
    },
    // Below md the table scrolls horizontally inside its card rather than
    // collapsing into stacked cards - same pinned-column approach as
    // Faculty. Pinning Name (the clickable link to a subject's detail
    // page) means it's still visible while scrolling right.
    initialState: {
      columnPinning: { left: ["name"] },
    },
  });

  const { filters, setFilters } = SubjectTable.refineCore;

  const [searchQuery, setSearchQuery] = useState(() =>
    getFilterValue(filters, "name"),
  );
  const [selectedDepartment, setSelectedDepartment] = useState(
    () => getFilterValue(filters, "department") || "all",
  );
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const nextFilters = [];
    if (debouncedSearch) {
      nextFilters.push({
        field: "name",
        operator: "contains" as const,
        value: debouncedSearch,
      });
    }
    if (selectedDepartment !== "all") {
      nextFilters.push({
        field: "department",
        operator: "eq" as const,
        value: selectedDepartment,
      });
    }
    setFilters(nextFilters, "replace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, selectedDepartment]);

  // Keeps the search/department controls in sync when `filters` changes from
  // outside this component's own debounced push above — browser back/forward
  // navigation, or an external link landing on this page with a filter set.
  useEffect(() => {
    setSearchQuery(getFilterValue(filters, "name"));
    setSelectedDepartment(getFilterValue(filters, "department") || "all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <ListView>
      <Breadcrumb />

      <h1 className="page-title">Subjects</h1>

      <p className="text-sm text-muted-foreground">
        The course catalog — every subject offered, organized by department.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="search-field sm:w-1/3">
          <Search className="search-icon" />
          <Input
            type="text"
            placeholder="Search by name..."
            className="pl-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Select
            value={selectedDepartment}
            onValueChange={setSelectedDepartment}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by department ..." />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.name}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <CreateButton>
            <div className="flex items-center gap-2 font-semibold">
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </div>
          </CreateButton>
        </div>
      </div>

      <DataTable table={SubjectTable} />
    </ListView>
  );
};
export default SubjectsList;

import { ListView } from "@/components/refine-ui/views/list-view.tsx";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb.tsx";
import { SlidersHorizontal, Search } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useState, useMemo, useEffect, useRef } from "react";
import { useTable } from "@refinedev/react-table";
import { type ColumnDef } from "@tanstack/react-table";
import { useLink, useNavigation } from "@refinedev/core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { CreateButton } from "@/components/refine-ui/buttons/create.tsx";
import { DataTable } from "@/components/refine-ui/data-table/data-table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { EditButton } from "@/components/refine-ui/buttons/edit.tsx";
import { DeleteButton } from "@/components/refine-ui/buttons/delete.tsx";
import { Department } from "@/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value.ts";
import { getFilterValue } from "@/lib/filters.ts";

const DepartmentsList = () => {
  const { showUrl } = useNavigation();
  const Link = useLink();

  const DepartmentsTable = useTable<Department>({
    columns: useMemo<ColumnDef<Department>[]>(
      () => [
        {
          id: "code",
          accessorKey: "code",
          size: 100,
          header: () => <p className="column-title ml-2">Code</p>,
          cell: ({ getValue }) => <Badge>{getValue() as string}</Badge>,
        },
        {
          id: "name",
          accessorKey: "name",
          size: 200,
          header: () => <p className="column-title">Name</p>,
          // The Name link IS the "View" action - hovering/clicking a
          // department opens its detail page, so a separate View button in
          // Actions would just be a second control doing the same thing.
          cell: ({ getValue, row }) => (
            <Link
              to={showUrl("departments", row.original.id)}
              className="font-medium text-foreground hover:underline"
            >
              {getValue<string>()}
            </Link>
          ),
        },
        {
          id: "description",
          accessorKey: "description",
          size: 300,
          header: () => <p className="column-title">Description</p>,
          cell: ({ getValue }) => (
            <span className="truncate line-clamp-2">
              {getValue<string>()}
            </span>
          ),
        },
        {
          id: "subjectCount",
          accessorKey: "subjectCount",
          size: 120,
          header: () => <p className="column-title">Subjects</p>,
          cell: ({ getValue }) => (
            <Badge variant="secondary">{getValue<number>() ?? 0}</Badge>
          ),
        },
        {
          id: "actions",
          size: 160,
          header: () => <p className="column-title">Actions</p>,
          cell: ({ row }) => (
            <div className="flex items-center gap-2">
              <EditButton
                resource="departments"
                recordItemId={row.original.id}
                variant="outline"
                size="sm"
              >
                Edit
              </EditButton>
              <DeleteButton
                resource="departments"
                recordItemId={row.original.id}
                size="sm"
              >
                Delete
              </DeleteButton>
            </div>
          ),
        },
      ],
      [showUrl, Link],
    ),
    refineCoreProps: {
      resource: "departments",
      pagination: { pageSize: 10, mode: "server" },
      filters: {
        defaultBehavior: "replace",
      },
      sorters: {
        initial: [{ field: "id", order: "desc" }],
      },
      syncWithLocation: true,
    },
  });

  const { filters, setFilters } = DepartmentsTable.refineCore;

  const [searchQuery, setSearchQuery] = useState(() => getFilterValue(filters, "name"));
  const [hasSubjects, setHasSubjects] = useState(() => getFilterValue(filters, "hasSubjects") || "all");
  const [filtersPopoverOpen, setFiltersPopoverOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const activeFilterCount = hasSubjects !== "all" ? 1 : 0;

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const nextFilters = [];
    if (debouncedSearch) {
      nextFilters.push({ field: "name", operator: "contains" as const, value: debouncedSearch });
    }
    if (hasSubjects !== "all") {
      nextFilters.push({ field: "hasSubjects", operator: "eq" as const, value: hasSubjects });
    }
    setFilters(nextFilters, "replace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, hasSubjects]);

  // Keeps the search/filter controls in sync when `filters` changes from
  // outside this component's own debounced push above — browser back/forward
  // navigation, or an external link landing on this page with a filter already set.
  useEffect(() => {
    setSearchQuery(getFilterValue(filters, "name"));
    setHasSubjects(getFilterValue(filters, "hasSubjects") || "all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const clearAllFilters = () => {
    setHasSubjects("all");
    setFiltersPopoverOpen(false);
  };

  return (
    <ListView>
      <Breadcrumb />

      <h1 className="page-title">Departments</h1>

      <p className="text-sm text-muted-foreground">
        Every academic department and how many subjects it currently teaches.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="search-field sm:w-1/3">
          <Search className="search-icon" />
          <Input
            type="text"
            placeholder="Search by name or code..."
            className="pl-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-row items-center gap-2">
          <Popover open={filtersPopoverOpen} onOpenChange={setFiltersPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Subjects</span>
                  <Select value={hasSubjects} onValueChange={setHasSubjects}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Filter by subjects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      <SelectItem value="true">Has subjects</SelectItem>
                      <SelectItem value="false">No subjects yet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={activeFilterCount === 0}
                  onClick={clearAllFilters}
                >
                  Clear all
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <CreateButton resource="departments" />
        </div>
      </div>

      <DataTable table={DepartmentsTable} />
    </ListView>
  );
};

export default DepartmentsList;

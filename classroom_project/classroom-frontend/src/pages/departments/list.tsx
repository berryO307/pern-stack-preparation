import { ListView } from "@/components/refine-ui/views/list-view.tsx";
import { Breadcrumb } from "@/components/ui/breadcrumb.tsx";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { useState, useMemo, useEffect, useRef } from "react";
import { useTable } from "@refinedev/react-table";
import { type ColumnDef } from "@tanstack/react-table";
import { CreateButton } from "@/components/refine-ui/buttons/create.tsx";
import { DataTable } from "@/components/refine-ui/data-table/data-table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ShowButton } from "@/components/refine-ui/buttons/show.tsx";
import { EditButton } from "@/components/refine-ui/buttons/edit.tsx";
import { DeleteButton } from "@/components/refine-ui/buttons/delete.tsx";
import { Department } from "@/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value.ts";
import { getFilterValue } from "@/lib/filters.ts";

const DepartmentsList = () => {
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
          cell: ({ getValue }) => (
            <span className="text-foreground">{getValue<string>()}</span>
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
          size: 220,
          header: () => <p className="column-title">Actions</p>,
          cell: ({ row }) => (
            <div className="flex items-center gap-2">
              <ShowButton
                resource="departments"
                recordItemId={row.original.id}
                variant="outline"
                size="sm"
              >
                View
              </ShowButton>
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
      [],
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
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setFilters(
      debouncedSearch
        ? [{ field: "name", operator: "contains", value: debouncedSearch }]
        : [],
      "replace",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  return (
    <ListView>
      <Breadcrumb />

      <h1 className="page-title">Departments</h1>

      <div className="intro-row">
        <p>Quick access to essential metrics and management tools.</p>

        <div className="actions-row">
          <div className="search-field">
            <Search className="search-icon" />
            <Input
              type="text"
              placeholder="Search by name or code..."
              className="pl-10 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <CreateButton resource="departments" />
        </div>
      </div>

      <DataTable table={DepartmentsTable} />
    </ListView>
  );
};

export default DepartmentsList;

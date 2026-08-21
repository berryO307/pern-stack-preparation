import { ListView } from "@/components/refine-ui/views/list-view.tsx";
import { Breadcrumb } from "@/components/ui/breadcrumb.tsx";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { useState, useMemo, useEffect, useRef } from "react";
import { useTable } from "@refinedev/react-table";
import { type ColumnDef } from "@tanstack/react-table";
import { useList } from "@refinedev/core";
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
import type { Class, Subject, User } from "@/types";
import { ShowButton } from "@/components/refine-ui/buttons/show.tsx";
import { useDebouncedValue } from "@/hooks/use-debounced-value.ts";
import { getFilterValue } from "@/lib/filters.ts";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

const ClassesList = () => {
  const { query: subjectsQuery } = useList<Subject>({
    resource: "subjects",
    pagination: {
      pageSize: 100,
    },
  });

  const { query: teachersQuery } = useList<User>({
    resource: "users",
    filters: [{ field: "role", operator: "eq", value: "teacher" }],
    pagination: {
      pageSize: 100,
    },
  });

  const subjects = subjectsQuery?.data?.data || [];
  const teachers = teachersQuery?.data?.data || [];

  const ClassesTable = useTable<Class>({
    columns: useMemo<ColumnDef<Class>[]>(
      () => [
        {
          id: "bannerUrl",
          accessorKey: "bannerUrl",
          size: 100,
          header: () => <p className="column-title ml-2">Banner</p>,
          cell: ({ getValue }) => {
            const bannerUrl = getValue<string | undefined>();
            return bannerUrl ? (
              <img
                src={bannerUrl}
                alt="Class banner"
                className="h-10 w-16 rounded object-cover"
              />
            ) : (
              <div className="h-10 w-16 rounded bg-muted" />
            );
          },
        },
        {
          id: "name",
          accessorKey: "name",
          size: 200,
          header: () => <p className="column-title">Class Name</p>,
          cell: ({ getValue }) => (
            <span className="text-foreground">{getValue<string>()}</span>
          ),
        },
        {
          id: "status",
          accessorKey: "status",
          size: 120,
          header: () => <p className="column-title">Status</p>,
          cell: ({ getValue }) => {
            const status = getValue<string>();
            return (
              <Badge variant={status === "active" ? "default" : "secondary"}>
                {status?.toUpperCase()}
              </Badge>
            );
          },
        },
        {
          id: "subject",
          accessorKey: "subject.name",
          size: 150,
          header: () => <p className="column-title">Subject</p>,
          cell: ({ getValue }) => (
            <Badge variant="secondary">{getValue<string>()}</Badge>
          ),
        },
        {
          id: "teacher",
          accessorKey: "teacher.name",
          size: 150,
          header: () => <p className="column-title">Teacher</p>,
          cell: ({ getValue }) => (
            <span className="text-foreground">{getValue<string>()}</span>
          ),
        },
        {
          id: "capacity",
          accessorKey: "capacity",
          size: 100,
          header: () => <p className="column-title">Capacity</p>,
          cell: ({ getValue }) => (
            <span className="text-foreground">{getValue<number>()}</span>
          ),
        },
        {
          id: "details",
          size: 140,
          header: () => <p className="column-title">Details</p>,
          cell: ({ row }) => (
            <ShowButton
              resource="classes"
              recordItemId={row.original.id}
              variant="outline"
              size="sm"
            >
              View
            </ShowButton>
          ),
        },
      ],
      [],
    ),
    refineCoreProps: {
      resource: "classes",
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

  const { filters, setFilters } = ClassesTable.refineCore;

  const [searchQuery, setSearchQuery] = useState(() => getFilterValue(filters, "name"));
  const [selectedSubject, setSelectedSubject] = useState(() => getFilterValue(filters, "subject") || "all");
  const [selectedTeacher, setSelectedTeacher] = useState(() => getFilterValue(filters, "teacher") || "all");
  const [selectedStatus, setSelectedStatus] = useState(() => getFilterValue(filters, "status") || "all");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

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
    if (selectedSubject !== "all") {
      nextFilters.push({ field: "subject", operator: "eq" as const, value: selectedSubject });
    }
    if (selectedTeacher !== "all") {
      nextFilters.push({ field: "teacher", operator: "eq" as const, value: selectedTeacher });
    }
    if (selectedStatus !== "all") {
      nextFilters.push({ field: "status", operator: "eq" as const, value: selectedStatus });
    }
    setFilters(nextFilters, "replace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, selectedSubject, selectedTeacher, selectedStatus]);

  // Keeps the search/filter controls in sync when `filters` changes from
  // outside this component's own debounced push above — browser back/forward
  // navigation, or an external link (e.g. the dashboard's "View full report")
  // landing on this page with a filter/sort already set.
  useEffect(() => {
    setSearchQuery(getFilterValue(filters, "name"));
    setSelectedSubject(getFilterValue(filters, "subject") || "all");
    setSelectedTeacher(getFilterValue(filters, "teacher") || "all");
    setSelectedStatus(getFilterValue(filters, "status") || "all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <ListView>
      <Breadcrumb />

      <h1 className="page-title">Classes</h1>

      <div className="intro-row">
        <p>Quick Access to essential metrics and management tools.</p>

        <div className="actions-row">
          <div className="search-field">
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
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by subject ..." />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.name}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by teacher ..." />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">All Teachers</SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.name}>
                    {teacher.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status ..." />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <CreateButton resource="classes" />
          </div>
        </div>
      </div>

      <DataTable table={ClassesTable} />
    </ListView>
  );
};
export default ClassesList;

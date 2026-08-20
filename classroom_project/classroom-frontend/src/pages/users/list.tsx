import { ListView } from "@/components/refine-ui/views/list-view.tsx";
import { Breadcrumb } from "@/components/ui/breadcrumb.tsx";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { useState, useMemo } from "react";
import { useTable } from "@refinedev/react-table";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { ROLE_OPTIONS } from "@/constants";
import { CreateButton } from "@/components/refine-ui/buttons/create.tsx";
import { DataTable } from "@/components/refine-ui/data-table/data-table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ShowButton } from "@/components/refine-ui/buttons/show.tsx";
import { EditButton } from "@/components/refine-ui/buttons/edit.tsx";
import { DeleteButton } from "@/components/refine-ui/buttons/delete.tsx";
import { User } from "@/types";

const ROLE_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  teacher: "secondary",
  student: "outline",
};

const UsersList = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");

  const roleFilters =
    selectedRole === "all"
      ? []
      : [{ field: "role", operator: "eq" as const, value: selectedRole }];

  const searchFilters = searchQuery
    ? [{ field: "name", operator: "contains" as const, value: searchQuery }]
    : [];

  const UsersTable = useTable<User>({
    columns: useMemo<ColumnDef<User>[]>(
      () => [
        {
          id: "name",
          accessorKey: "name",
          size: 200,
          header: () => <p className="column-title ml-2">Name</p>,
          cell: ({ getValue, row }) => (
            <div className="flex items-center gap-2 ml-2">
              {row.original.image ? (
                <img
                  src={row.original.image}
                  alt={getValue<string>()}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted" />
              )}
              <span className="text-foreground">{getValue<string>()}</span>
            </div>
          ),
        },
        {
          id: "email",
          accessorKey: "email",
          size: 240,
          header: () => <p className="column-title">Email</p>,
          cell: ({ getValue }) => (
            <span className="text-muted-foreground">{getValue<string>()}</span>
          ),
        },
        {
          id: "role",
          accessorKey: "role",
          size: 120,
          header: () => <p className="column-title">Role</p>,
          cell: ({ getValue }) => {
            const role = getValue<string>();
            return (
              <Badge variant={ROLE_BADGE_VARIANT[role] ?? "outline"}>
                {role?.toUpperCase()}
              </Badge>
            );
          },
        },
        {
          id: "actions",
          size: 220,
          header: () => <p className="column-title">Actions</p>,
          cell: ({ row }) => (
            <div className="flex items-center gap-2">
              <ShowButton
                resource="users"
                recordItemId={row.original.id}
                variant="outline"
                size="sm"
              >
                View
              </ShowButton>
              <EditButton
                resource="users"
                recordItemId={row.original.id}
                variant="outline"
                size="sm"
              >
                Edit
              </EditButton>
              <DeleteButton
                resource="users"
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
      resource: "users",
      pagination: { pageSize: 10, mode: "server" },
      filters: {
        permanent: [...searchFilters, ...roleFilters],
      },
      sorters: {
        initial: [{ field: "createdAt", order: "desc" }],
      },
    },
  });

  return (
    <ListView>
      <Breadcrumb />

      <h1 className="page-title">Users</h1>

      <div className="intro-row">
        <p>Quick access to essential metrics and management tools.</p>

        <div className="actions-row">
          <div className="search-field">
            <Search className="search-icon" />
            <Input
              type="text"
              placeholder="Search by name or email..."
              className="pl-10 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by role ..." />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <CreateButton resource="users" />
          </div>
        </div>
      </div>

      <DataTable table={UsersTable} />
    </ListView>
  );
};

export default UsersList;

import { ListView } from "@/components/refine-ui/views/list-view.tsx";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb.tsx";
import { Search, X, SlidersHorizontal, MoreVertical, Pencil, Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { useTable } from "@refinedev/react-table";
import { type ColumnDef } from "@tanstack/react-table";
import { useDelete, useLink, useNavigation } from "@refinedev/core";
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
import { PersonCell } from "@/components/person-cell.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { ROLE_OPTIONS } from "@/constants";
import { CreateButton } from "@/components/refine-ui/buttons/create.tsx";
import { DataTable } from "@/components/refine-ui/data-table/data-table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { DepartmentBadge } from "@/components/department-badge.tsx";
import { User } from "@/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value.ts";
import { getFilterValue } from "@/lib/filters.ts";
import { useIsAdmin } from "@/hooks/use-is-admin.ts";
import { buildAvatarSrc } from "@/lib/cloudinary.ts";
import { trackRumEvent, reportRumError } from "@/lib/rum.ts";

// View stays a plain visible button (the action everyone can take); Edit and
// Delete move behind a kebab menu so a destructive, irreversible action isn't
// a full-width red block repeated down every row. Delete still requires
// explicit confirmation naming the person, via a real AlertDialog rather than
// a small inline popover, and uses mutationMode: "optimistic" so the row
// disappears immediately and Refine's own rollback restores it if the
// request actually fails - "restore the row on failure" for free rather than
// hand-rolled cache surgery.
function UserRowActions({ user }: { user: User }) {
  const { edit } = useNavigation();
  const { mutate: deleteUser, mutation } = useDelete();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = () => {
    deleteUser(
      { resource: "users", id: user.id, mutationMode: "optimistic" },
      {
        onSuccess: () => setConfirmOpen(false),
        onError: (error) => {
          reportRumError(`Failed to delete user (status ${error?.statusCode ?? "unknown"}): ${error?.message ?? "unknown error"}`);
        },
      },
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label={`Actions for ${user.name}`}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => edit("users", user.id)}>
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
            <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={mutation.isPending}
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Colour tokens are off-limits, so roles are distinguished by tint-vs-neutral
// rather than by hue: admin (the standout role on the generic Users view)
// gets a soft primary tint, everything else is a plain secondary chip. The
// text carries the meaning either way - the tint is decoration, not the only
// signal.
const ROLE_BADGE_TINT_CLASS: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-transparent",
};

const titleCase = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

type UsersListProps = {
  title?: string;
  subtitle?: string;
  defaultRole?: string;
  /** Noun for empty-state copy, e.g. "faculty members". */
  emptyStateNoun?: string;
  /** Resource a row's name/avatar links to - "faculty" from the Faculty view so it lands on the Faculty-scoped profile page, not the generic Users one. */
  showResource?: string;
};

const UsersList = ({
  title = "Users",
  subtitle = "Manage every account across the institution",
  defaultRole = "all",
  emptyStateNoun = "users",
  showResource = "users",
}: UsersListProps = {}) => {
  const { isAdmin } = useIsAdmin();
  const { showUrl } = useNavigation();
  const Link = useLink();
  const location = useLocation();
  // Every row on the Faculty view is already role=teacher, so a Role column
  // there is dead weight (see brief C4) - Department (derived server-side
  // from what they teach) actually varies and carries information.
  const showDepartmentColumn = defaultRole === "teacher";

  // Faculty's "teacher" scope and the Total students KPI card's "student"
  // preset both need to reach the very first fetch. Carrying either through
  // useTable's `filters` (whether via `filters.initial` or a `setFilters`
  // call, no matter how it's timed) hits a confirmed upstream bug: Refine's
  // own useTable has an internal effect that resets `filters` back to
  // defaults whenever the parsed URL has no query string, and it keeps
  // re-firing well into the mount sequence, silently reverting any filter
  // pushed through the normal channel (reproduced live via a debug trace -
  // waiting for the initial fetch to settle before pushing didn't dodge it
  // either). `meta` is a separate parameter the data provider reads
  // directly and Refine never touches for this reset - baselineRole travels
  // that way instead, so the base scope for this page is immune to the bug.
  // The Filters popover's own role choice still goes through `filters`
  // normally when it actively differs from this baseline (see the push
  // effect below), which remains a safe, already-proven path since it fires
  // from real user interaction well after mount, not close to it.
  // Captured once, not read fresh every render: `syncWithLocation` makes
  // Refine call history.replace() on its own (to reflect pagination/sorter
  // changes in the URL), and that replace doesn't carry the router `state`
  // this came in on - `location.state` goes back to `null` the moment that
  // first happens, which silently dropped the preset a render or two after
  // landing here (confirmed live: the KPI card's role scope applied to the
  // rows shown but then vanished from the page-count math).
  const presetRoleRef = useRef(
    (location.state as { presetRole?: string } | null)?.presetRole,
  );
  const presetRole = presetRoleRef.current;
  const baselineRole = defaultRole !== "all" ? defaultRole : presetRole;
  const baselineMeta = useMemo(
    () => (baselineRole ? { defaultRole: baselineRole } : undefined),
    [baselineRole],
  );

  const UsersTable = useTable<User>({
    columns: useMemo<ColumnDef<User>[]>(
      () => [
        {
          id: "name",
          accessorKey: "name",
          size: 220,
          header: () => <p className="column-title ml-2">Name</p>,
          cell: ({ getValue, row }) => {
            const name = getValue<string>();
            const avatarSrc = buildAvatarSrc(row.original.imageCldPubId, row.original.image);
            return (
              <Link to={showUrl(showResource, row.original.id)} className="ml-2 inline-block">
                <PersonCell name={name} avatarSrc={avatarSrc} />
              </Link>
            );
          },
        },
        {
          id: "email",
          accessorKey: "email",
          size: 240,
          header: () => <p className="column-title">Email</p>,
          cell: ({ getValue }) => (
            <span className="block truncate text-sm text-muted-foreground">{getValue<string>()}</span>
          ),
        },
        showDepartmentColumn
          ? {
              id: "department",
              size: 220,
              header: () => <p className="column-title w-full justify-center">Department</p>,
              cell: ({ row }) => {
                const department = row.original.department;
                return (
                  <div className="flex w-full justify-center">
                    {department ? (
                      <DepartmentBadge name={department.name} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                );
              },
            }
          : {
              id: "role",
              accessorKey: "role",
              size: 120,
              header: () => <p className="column-title">Role</p>,
              cell: ({ getValue }) => {
                const role = getValue<string>();
                const tintClass = ROLE_BADGE_TINT_CLASS[role];
                return (
                  <Badge variant={tintClass ? "outline" : "secondary"} className={tintClass}>
                    {titleCase(role)}
                  </Badge>
                );
              },
            },
        {
          id: "actions",
          size: 60,
          // View is gone as a button - clicking the name/avatar does that now
          // - so this column is just the kebab (Edit/Delete), narrow instead
          // of a wide two-button block pinned far from the row's own content.
          header: () => <p className="column-title w-full justify-end">Actions</p>,
          cell: ({ row }) =>
            isAdmin ? (
              <div className="flex items-center justify-end">
                <UserRowActions user={row.original} />
              </div>
            ) : null,
        },
      ],
      [isAdmin, showDepartmentColumn, showResource, showUrl],
    ),
    refineCoreProps: {
      resource: "users",
      pagination: { pageSize: 10, mode: "server" },
      filters: {
        defaultBehavior: "replace",
      },
      sorters: {
        initial: [{ field: "createdAt", order: "desc" }],
      },
      syncWithLocation: true,
      meta: baselineMeta,
    },
    // Below md the table scrolls horizontally inside its card rather than
    // collapsing into stacked cards - reuses DataTable's existing pinned-
    // column sticky logic (built for this) instead of a second, parallel
    // mobile layout to maintain. Pinning Name means it's still visible
    // while scrolling right to reach Actions.
    initialState: {
      columnPinning: { left: ["name"] },
    },
  });

  const { filters, setFilters, setCurrentPage, tableQuery } = UsersTable.refineCore;

  const [searchQuery, setSearchQuery] = useState(() => getFilterValue(filters, "name"));
  const [selectedRole, setSelectedRole] = useState(
    () => getFilterValue(filters, "role") || baselineRole || "all",
  );
  const [filtersPopoverOpen, setFiltersPopoverOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  // A role-locked view like Faculty (or /users landed on from the Total
  // students KPI card) always has selectedRole === baselineRole just by
  // existing - that's the page's own built-in scope, not something the
  // visitor chose, so it shouldn't count as an active filter (it was
  // inflating the Filters badge to "1" on first load, and would have made
  // the empty state claim "filters are hiding results" when the table was
  // genuinely empty).
  const isRoleFilterActive = selectedRole !== "all" && selectedRole !== (baselineRole ?? "all");
  const activeFilterCount = isRoleFilterActive ? 1 : 0;
  const hasActiveFilters = Boolean(searchQuery) || isRoleFilterActive;

  // Site24x7's RUM beacon has no duration/metadata API for custom events -
  // verified in lib/rum.ts, `addEvent` is occurrence-only. So "record a
  // timing tagged by whether filters were active" is only honestly doable
  // as two distinct event names (filtered vs unfiltered), not an actual
  // timing metric - this can't be more than that until Site24x7 exposes one.
  useEffect(() => {
    if (!tableQuery.isSuccess) return;
    trackRumEvent(hasActiveFilters ? "list_query_filtered" : "list_query_unfiltered");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableQuery.dataUpdatedAt]);

  // `searchQuery`/`selectedRole` are the single source of truth for these
  // controls, pushed one-way into `filters` below (no reactive "sync back
  // from filters" effect - see baselineMeta above for why that direction is
  // unsafe here). The page's own baseline role scope travels via `meta`,
  // not `filters`, so this effect only ever needs to push a `role` filter
  // when the visitor's own choice actively differs from that baseline -
  // exactly the same "only touch filters from a real, later interaction"
  // shape already proven safe on Subjects/Departments.
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
    if (selectedRole !== "all" && selectedRole !== (baselineRole ?? "all")) {
      nextFilters.push({ field: "role", operator: "eq" as const, value: selectedRole });
    }
    setFilters(nextFilters, "replace");
    setCurrentPage(1); // a stale page number after filtering can read as "no results"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, selectedRole]);

  const clearAllFilters = () => {
    // Back to the page's own baseline scope, not an unscoped view - on
    // Faculty that's "teacher", not "all roles".
    setSelectedRole(baselineRole ?? "all");
    setFiltersPopoverOpen(false);
  };

  // Broader than the Filters popover's own Clear all: the empty state's
  // "Clear filters" means "get me back to seeing rows at all", so it also
  // resets search, not just Role.
  const clearAllActiveFilters = () => {
    setSearchQuery("");
    setSelectedRole(baselineRole ?? "all");
  };

  return (
    <ListView>
      <Breadcrumb />

      <h1 className="page-title">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="search-field sm:w-1/3">
          <Search className="search-icon" />
          <Input
            type="text"
            placeholder="Search by name or email"
            className="pl-10 pr-8 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
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
                  <span className="text-sm font-medium">Role</span>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Filter by role" />
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

          {isAdmin && (
            <CreateButton resource="users">
              <div className="flex items-center gap-2 font-semibold">
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </div>
            </CreateButton>
          )}
        </div>
      </div>

      <DataTable
        table={UsersTable}
        caption={`${title}, filtered and sorted by the controls above`}
        emptyStateLabel={emptyStateNoun}
        emptyStateAction={isAdmin && <CreateButton resource="users" variant="default" />}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearAllActiveFilters}
      />
    </ListView>
  );
};

export default UsersList;

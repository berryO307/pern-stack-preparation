import { ListView } from "@/components/refine-ui/views/list-view.tsx";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb.tsx";
import {
  Search,
  X,
  SlidersHorizontal,
  Plus,
  Code,
  Calculator,
  Briefcase,
  Palette,
  Atom,
  Brain,
  Leaf,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar.tsx";
import { CreateButton } from "@/components/refine-ui/buttons/create.tsx";
import { DataTable } from "@/components/refine-ui/data-table/data-table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { PersonCell } from "@/components/person-cell.tsx";
import type { Class, Subject, User } from "@/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value.ts";
import { getFilterValue } from "@/lib/filters.ts";
import { cn } from "@/lib/utils.ts";
import { buildAvatarSrc, buildClassBannerThumbUrl } from "@/lib/cloudinary.ts";
import { trackRumEvent } from "@/lib/rum.ts";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

// Decorative, not semantic - a subject's tint is only ever a stable visual
// grouping cue (same subject = same colour across pages and reloads), never
// a signal in its own right. The theme's --chart-1..5 tokens are all one
// hue at different lightness steps (this theme's chart palette is
// monochrome blue), which read as "everything is purple" - Tailwind's own
// palette gives real hue variety instead, same approach as DepartmentBadge.
// Full literal class strings (not template-interpolated) because Tailwind's
// scanner only picks up complete strings it can find in source.
const SUBJECT_TINT_BADGE_CLASSES = [
  "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-transparent",
  "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-transparent",
  "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-transparent",
  "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-transparent",
  "bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border-transparent",
  "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-transparent",
  "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-transparent",
  "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-transparent",
];
const SUBJECT_TINT_AVATAR_CLASSES = [
  "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300",
  "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300",
  "bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300",
  "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300",
  "bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300",
  "bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300",
  "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300",
  "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300",
];

const hashToTintIndex = (seed: number | string): number => {
  const str = String(seed);
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return hash % SUBJECT_TINT_BADGE_CLASSES.length;
};

// A department-level icon for the banner fallback, so an unset banner reads
// as "this class is a Physics class" at a glance instead of just initials.
// Keyed by department name rather than subject, since a subject's field is
// the more stable "type" signal (new subjects under Physics should get the
// same icon without a code change here).
const DEPARTMENT_ICONS: Record<string, LucideIcon> = {
  "Computer Science": Code,
  Mathematics: Calculator,
  "Business Administration": Briefcase,
  "Fine Arts": Palette,
  Physics: Atom,
  Psychology: Brain,
  "Environmental Science": Leaf,
};

const ClassesList = () => {
  const { showUrl } = useNavigation();
  const Link = useLink();

  const { query: subjectsQuery } = useList<Subject>({
    resource: "subjects",
    pagination: { pageSize: 100 },
  });

  const { query: teachersQuery } = useList<User>({
    resource: "users",
    filters: [{ field: "role", operator: "eq", value: "teacher" }],
    pagination: { pageSize: 100 },
  });

  const subjects = subjectsQuery?.data?.data || [];
  const teachers = teachersQuery?.data?.data || [];

  const ClassesTable = useTable<Class>({
    columns: useMemo<ColumnDef<Class>[]>(
      () => [
        {
          id: "banner",
          size: 64,
          header: () => <p className="column-title ml-2">Banner</p>,
          // Priority: the class's own uploaded banner, then its subject's
          // uploaded image, then a department icon (so an unset banner
          // still reads as "this is a Physics class" instead of bare
          // initials), then initials as the last resort.
          cell: ({ row }) => {
            const cls = row.original;
            const src = cls.bannerCldPubId
              ? buildClassBannerThumbUrl(cls.bannerCldPubId)
              : cls.bannerUrl || (cls.subject?.imageCldPubId
                  ? buildClassBannerThumbUrl(cls.subject.imageCldPubId)
                  : undefined);
            const tintIndex = hashToTintIndex(cls.subject?.id ?? cls.id);
            const DepartmentIcon = cls.department?.name ? DEPARTMENT_ICONS[cls.department.name] : undefined;
            return (
              <Avatar className="h-10 w-10">
                {src && <AvatarImage src={src} alt="" loading="lazy" width={80} height={80} />}
                <AvatarFallback className={SUBJECT_TINT_AVATAR_CLASSES[tintIndex]}>
                  {DepartmentIcon ? (
                    <DepartmentIcon className="h-4.5 w-4.5" />
                  ) : (
                    <BookOpen className="h-4.5 w-4.5" />
                  )}
                </AvatarFallback>
              </Avatar>
            );
          },
        },
        {
          id: "name",
          accessorKey: "name",
          // A fixed width, not "flex to fill remaining space" - this column
          // is pinned, and a pinned column's rendered width has to be
          // deterministic or the sticky-offset math for whatever comes
          // after it (Subject) breaks, which is exactly what an earlier
          // min-width/flex combination here did (headers overlapped).
          meta: { flex: true, className: "w-[240px]" },
          header: () => <p className="column-title">Class Name</p>,
          // Plain text at rest - it should not look like a link until the
          // user goes near it. Hover/focus-visible both get the same
          // affordance so keyboard users get an identical cue to mouse
          // users. A real anchor (not an onClick div) so middle-click,
          // Cmd/Ctrl-click, right-click -> copy link, and tab focus all
          // work for free.
          cell: ({ getValue, row }) => (
            <Link
              to={showUrl("classes", row.original.id)}
              title={getValue<string>()}
              className="inline-block truncate rounded px-1 py-0.5 -mx-1 font-medium text-foreground hover:text-primary hover:underline focus-visible:text-primary focus-visible:underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {getValue<string>()}
            </Link>
          ),
        },
        {
          id: "subject",
          accessorKey: "subject.name",
          size: 180,
          header: () => <p className="column-title">Subject</p>,
          cell: ({ row }) => {
            const subject = row.original.subject;
            if (!subject) return <span className="text-muted-foreground">—</span>;
            const tintIndex = hashToTintIndex(subject.id);
            return (
              <Badge className={SUBJECT_TINT_BADGE_CLASSES[tintIndex]}>
                {subject.name}
              </Badge>
            );
          },
        },
        {
          id: "teacher",
          accessorKey: "teacher.name",
          size: 200,
          header: () => <p className="column-title">Teacher</p>,
          cell: ({ row }) => {
            const teacher = row.original.teacher;
            if (!teacher) return <span className="text-muted-foreground">—</span>;
            return (
              <PersonCell
                name={teacher.name}
                avatarSrc={buildAvatarSrc(teacher.imageCldPubId, teacher.image)}
              />
            );
          },
        },
        {
          id: "status",
          accessorKey: "status",
          size: 130,
          header: () => <p className="column-title">Status</p>,
          cell: ({ getValue }) => {
            const status = getValue<string>();
            const isActive = status === "active";
            return (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-sm font-medium text-foreground">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isActive ? "bg-emerald-500" : "bg-muted-foreground",
                  )}
                />
                {STATUS_LABELS[status] ?? status}
              </span>
            );
          },
        },
        {
          id: "capacity",
          size: 120,
          header: () => <p className="column-title">Capacity</p>,
          cell: ({ row }) => {
            const { capacity, enrolledCount = 0 } = row.original;
            return (
              <span className="tabular-nums text-foreground">
                {enrolledCount}/{capacity}
              </span>
            );
          },
        },
      ],
      [showUrl, Link],
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
    // Below md the table scrolls horizontally inside its card rather than
    // collapsing into stacked cards - same pinned-column approach already
    // used on Faculty/Subjects. Pinning Class name means it's still visible
    // (and still the only way into a class) while scrolling right.
    initialState: {
      columnPinning: { left: ["name"] },
    },
  });

  const { filters, setFilters, setCurrentPage, tableQuery } = ClassesTable.refineCore;

  const [searchQuery, setSearchQuery] = useState(() => getFilterValue(filters, "name"));
  const [selectedSubject, setSelectedSubject] = useState(() => getFilterValue(filters, "subject") || "all");
  const [selectedTeacher, setSelectedTeacher] = useState(() => getFilterValue(filters, "teacher") || "all");
  const [selectedStatus, setSelectedStatus] = useState(() => getFilterValue(filters, "status") || "all");
  const [filtersPopoverOpen, setFiltersPopoverOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const activeFilterCount = [selectedSubject, selectedTeacher, selectedStatus].filter(
    (value) => value !== "all",
  ).length;
  const hasActiveFilters = Boolean(searchQuery) || activeFilterCount > 0;

  // Site24x7's RUM beacon has no duration/metadata API for custom events, so
  // "timing tagged by whether filters were active" is only honestly doable
  // as two distinct event names, matching the pattern already used on
  // Faculty rather than inventing a second convention.
  useEffect(() => {
    if (!tableQuery.isSuccess) return;
    trackRumEvent(hasActiveFilters ? "list_query_filtered" : "list_query_unfiltered");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableQuery.dataUpdatedAt]);

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
    setCurrentPage(1); // a stale page number after filtering can read as "no results"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, selectedSubject, selectedTeacher, selectedStatus]);

  // Keeps the search/filter controls in sync when `filters` changes from
  // outside this component's own debounced push above — browser back/forward
  // navigation, or an external link landing on this page with a filter set.
  useEffect(() => {
    setSearchQuery(getFilterValue(filters, "name"));
    setSelectedSubject(getFilterValue(filters, "subject") || "all");
    setSelectedTeacher(getFilterValue(filters, "teacher") || "all");
    setSelectedStatus(getFilterValue(filters, "status") || "all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const clearAllFilters = () => {
    setSelectedSubject("all");
    setSelectedTeacher("all");
    setSelectedStatus("all");
    setFiltersPopoverOpen(false);
  };

  // Broader than the Filters popover's own Clear all: the empty state's
  // "Clear filters" means "get me back to seeing rows at all", so it also
  // resets search, not just the three selects.
  const clearAllActiveFilters = () => {
    setSearchQuery("");
    setSelectedSubject("all");
    setSelectedTeacher("all");
    setSelectedStatus("all");
  };

  return (
    <ListView>
      <Breadcrumb />

      <div className="flex items-center justify-between gap-4">
        <h1 className="page-title">Classes</h1>
        <CreateButton resource="classes" variant="default">
          <div className="flex items-center gap-2 font-semibold">
            <Plus className="w-4 h-4" />
            <span>Create a class</span>
          </div>
        </CreateButton>
      </div>
      <p className="text-sm text-muted-foreground">
        Browse and manage classes across departments
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="search-field sm:w-1/3">
          <Search className="search-icon" />
          <Input
            type="text"
            placeholder="Search by name"
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
                  <span className="text-sm font-medium">Subject</span>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Filter by subject" />
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
                </div>

                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Teacher</span>
                  <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Filter by teacher" />
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
                </div>

                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Status</span>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Filter by status" />
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
        </div>
      </div>

      <DataTable
        table={ClassesTable}
        caption="Classes, filtered and sorted by the controls above"
        emptyStateLabel="classes"
        emptyStateAction={
          <CreateButton resource="classes" variant="default">
            Create a class
          </CreateButton>
        }
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearAllActiveFilters}
      />
    </ListView>
  );
};
export default ClassesList;

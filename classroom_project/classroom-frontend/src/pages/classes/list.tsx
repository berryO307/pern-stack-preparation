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
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { CreateButton } from "@/components/refine-ui/buttons/create.tsx";
import { DataTable } from "@/components/refine-ui/data-table/data-table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { PersonCell } from "@/components/person-cell.tsx";
import { ClassStatusBadge } from "@/components/class-status-badge.tsx";
import type { Class, Subject, User } from "@/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value.ts";
import { getFilterValue } from "@/lib/filters.ts";
import { CLASS_STATUS_OPTIONS, type ClassStatus } from "@/lib/class-status.ts";
import {
  SUBJECT_TINT_AVATAR_CLASSES,
  SUBJECT_TINT_BADGE_CLASSES,
  hashToTintIndex,
} from "@/lib/subject-tint.ts";
import { buildAvatarSrc, buildClassBannerThumbUrl } from "@/lib/cloudinary.ts";
import { trackRumEvent } from "@/lib/rum.ts";

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
          header: () => <p className="column-title">Banner</p>,
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
          cell: ({ getValue }) => <ClassStatusBadge status={getValue<string>()} />,
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
  // Multi-select: "active or inactive, but not archived" is the view most
  // people actually want, so status is a set of checkboxes rather than a
  // single dropdown value. Empty set == no filter (same as "all").
  const [selectedStatuses, setSelectedStatuses] = useState<ClassStatus[]>(() => {
    const raw = getFilterValue(filters, "status");
    return raw ? (raw.split(",") as ClassStatus[]) : [];
  });
  const [filtersPopoverOpen, setFiltersPopoverOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const activeFilterCount =
    [selectedSubject, selectedTeacher].filter((value) => value !== "all").length +
    (selectedStatuses.length > 0 ? 1 : 0);
  const hasActiveFilters = Boolean(searchQuery) || activeFilterCount > 0;

  const toggleStatus = (status: ClassStatus, checked: boolean) => {
    setSelectedStatuses((prev) =>
      checked ? [...prev, status] : prev.filter((s) => s !== status),
    );
  };

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
    if (selectedStatuses.length > 0) {
      nextFilters.push({ field: "status", operator: "eq" as const, value: selectedStatuses.join(",") });
    }
    setFilters(nextFilters, "replace");
    setCurrentPage(1); // a stale page number after filtering can read as "no results"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, selectedSubject, selectedTeacher, selectedStatuses]);

  // Keeps the search/filter controls in sync when `filters` changes from
  // outside this component's own debounced push above — browser back/forward
  // navigation, or an external link landing on this page with a filter set.
  useEffect(() => {
    setSearchQuery(getFilterValue(filters, "name"));
    setSelectedSubject(getFilterValue(filters, "subject") || "all");
    setSelectedTeacher(getFilterValue(filters, "teacher") || "all");
    const rawStatus = getFilterValue(filters, "status");
    // Compare by value and keep the same array reference when nothing
    // actually changed - a fresh array every run here (even one with
    // identical contents) makes the filter-push effect below see a
    // "changed" dependency on every render, which pushes back into
    // `filters`, which reruns this effect again: an infinite loop, the
    // exact bug already fixed once this session on a date-range picker.
    setSelectedStatuses((prev) => {
      const next = rawStatus ? (rawStatus.split(",") as ClassStatus[]) : [];
      const same = prev.length === next.length && prev.every((v, i) => v === next[i]);
      return same ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const clearAllFilters = () => {
    setSelectedSubject("all");
    setSelectedTeacher("all");
    setSelectedStatuses([]);
    setFiltersPopoverOpen(false);
  };

  // Broader than the Filters popover's own Clear all: the empty state's
  // "Clear filters" means "get me back to seeing rows at all", so it also
  // resets search, not just the three selects.
  const clearAllActiveFilters = () => {
    setSearchQuery("");
    setSelectedSubject("all");
    setSelectedTeacher("all");
    setSelectedStatuses([]);
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
                  <div className="space-y-2 rounded-md border p-2">
                    {CLASS_STATUS_OPTIONS.map((status) => (
                      <label
                        key={status.value}
                        className="flex items-center gap-2 text-sm font-normal"
                      >
                        <Checkbox
                          checked={selectedStatuses.includes(status.value)}
                          onCheckedChange={(checked) => toggleStatus(status.value, checked === true)}
                        />
                        {status.label}
                      </label>
                    ))}
                  </div>
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

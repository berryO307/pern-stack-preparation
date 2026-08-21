"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useList } from "@refinedev/core";
import { BookOpen, Building2, GraduationCap, Loader2, Search, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useSidebar } from "@/components/ui/sidebar.tsx";
import { useDebouncedValue } from "@/hooks/use-debounced-value.ts";
import { cn } from "@/lib/utils.ts";
import type { Class, Department, Subject, User } from "@/types";

const MIN_QUERY_LENGTH = 2;

const subjectSearchHref = (name: string) =>
  `/subjects?filters[0][field]=name&filters[0][operator]=contains&filters[0][value]=${encodeURIComponent(name)}`;

export const CommandSearch = () => {
  const navigate = useNavigate();
  const { open: sidebarOpen, isMobile } = useSidebar();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const enabled = debouncedQuery.trim().length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const { query: departmentsQuery } = useList<Department>({
    resource: "departments",
    filters: [{ field: "name", operator: "contains", value: debouncedQuery }],
    pagination: { pageSize: 5 },
    queryOptions: { enabled },
  });
  const { query: subjectsQuery } = useList<Subject>({
    resource: "subjects",
    filters: [{ field: "name", operator: "contains", value: debouncedQuery }],
    pagination: { pageSize: 5 },
    queryOptions: { enabled },
  });
  const { query: classesQuery } = useList<Class>({
    resource: "classes",
    filters: [{ field: "name", operator: "contains", value: debouncedQuery }],
    pagination: { pageSize: 5 },
    queryOptions: { enabled },
  });
  const { query: usersQuery } = useList<User>({
    resource: "users",
    filters: [{ field: "name", operator: "contains", value: debouncedQuery }],
    pagination: { pageSize: 5 },
    queryOptions: { enabled },
  });

  const departments = departmentsQuery?.data?.data ?? [];
  const subjects = subjectsQuery?.data?.data ?? [];
  const classes = classesQuery?.data?.data ?? [];
  const users = usersQuery?.data?.data ?? [];

  const isLoading =
    enabled &&
    (departmentsQuery.isFetching ||
      subjectsQuery.isFetching ||
      classesQuery.isFetching ||
      usersQuery.isFetching);

  const hasResults = departments.length + subjects.length + classes.length + users.length > 0;

  const goTo = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const collapsed = !sidebarOpen && !isMobile;

  return (
    <>
      <Button
        variant="outline"
        size={collapsed ? "icon" : "default"}
        className={cn(
          "text-muted-foreground font-normal h-9",
          collapsed ? "w-9 px-0" : "w-full justify-start gap-2 px-3"
        )}
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <Search className="size-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">Search...</span>
            <kbd className="pointer-events-none hidden select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
              ⌘K
            </kbd>
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>
            Search departments, subjects, classes and users
          </DialogDescription>
        </DialogHeader>
        <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
          <Command
            shouldFilter={false}
            className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3"
          >
            <CommandInput
              placeholder="Search departments, subjects, classes, users..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {enabled && isLoading && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              )}
              {enabled && !isLoading && !hasResults && (
                <CommandEmpty>No results for &quot;{debouncedQuery}&quot;</CommandEmpty>
              )}
              {!enabled && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Type at least {MIN_QUERY_LENGTH} characters to search
                </div>
              )}
              {enabled && !isLoading && departments.length > 0 && (
                <CommandGroup heading="Departments">
                  {departments.map((department) => (
                    <CommandItem
                      key={`department-${department.id}`}
                      value={`department-${department.id}`}
                      onSelect={() => goTo(`/departments/show/${department.id}`)}
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate">{department.name}</p>
                        <p className="text-xs text-muted-foreground">{department.code}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {enabled && !isLoading && subjects.length > 0 && (
                <CommandGroup heading="Subjects">
                  {subjects.map((subject) => (
                    <CommandItem
                      key={`subject-${subject.id}`}
                      value={`subject-${subject.id}`}
                      onSelect={() => goTo(subjectSearchHref(subject.name))}
                    >
                      <BookOpen className="h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate">{subject.name}</p>
                        <p className="text-xs text-muted-foreground">{subject.code}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {enabled && !isLoading && classes.length > 0 && (
                <CommandGroup heading="Classes">
                  {classes.map((klass) => (
                    <CommandItem
                      key={`class-${klass.id}`}
                      value={`class-${klass.id}`}
                      onSelect={() => goTo(`/classes/show/${klass.id}`)}
                    >
                      <GraduationCap className="h-4 w-4 shrink-0" />
                      <span className="truncate">{klass.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {enabled && !isLoading && users.length > 0 && (
                <CommandGroup heading="Users">
                  {users.map((user) => (
                    <CommandItem
                      key={`user-${user.id}`}
                      value={`user-${user.id}`}
                      onSelect={() => goTo(`/users/show/${user.id}`)}
                    >
                      <Users className="h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
};

CommandSearch.displayName = "CommandSearch";

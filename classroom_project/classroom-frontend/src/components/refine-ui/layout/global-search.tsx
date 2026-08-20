"use client";

import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useList } from "@refinedev/core";
import { BookOpen, Building2, GraduationCap, Loader2, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import { useDebouncedValue } from "@/hooks/use-debounced-value.ts";
import type { Class, Department, Subject, User } from "@/types";

const MIN_QUERY_LENGTH = 2;

const subjectSearchHref = (name: string) =>
  `/subjects?filters[0][field]=name&filters[0][operator]=contains&filters[0][value]=${encodeURIComponent(name)}`;

export const GlobalSearch = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 250);

  const enabled = debouncedQuery.trim().length >= MIN_QUERY_LENGTH;

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
    setQuery("");
    inputRef.current?.blur();
  };

  return (
    <Popover open={open && enabled} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="search-field w-full max-w-sm">
          <Search className="search-icon" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search departments, subjects, classes, users..."
            className="pl-10 w-full"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (query.trim().length >= MIN_QUERY_LENGTH) setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                inputRef.current?.blur();
              }
            }}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            )}
            {!isLoading && !hasResults && (
              <CommandEmpty>No results for &quot;{debouncedQuery}&quot;</CommandEmpty>
            )}
            {!isLoading && departments.length > 0 && (
              <CommandGroup heading="Departments">
                {departments.map((department) => (
                  <CommandItem
                    key={department.id}
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
            {!isLoading && subjects.length > 0 && (
              <CommandGroup heading="Subjects">
                {subjects.map((subject) => (
                  <CommandItem
                    key={subject.id}
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
            {!isLoading && classes.length > 0 && (
              <CommandGroup heading="Classes">
                {classes.map((klass) => (
                  <CommandItem
                    key={klass.id}
                    value={`class-${klass.id}`}
                    onSelect={() => goTo(`/classes/show/${klass.id}`)}
                  >
                    <GraduationCap className="h-4 w-4 shrink-0" />
                    <span className="truncate">{klass.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!isLoading && users.length > 0 && (
              <CommandGroup heading="Users">
                {users.map((user) => (
                  <CommandItem
                    key={user.id}
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
      </PopoverContent>
    </Popover>
  );
};

GlobalSearch.displayName = "GlobalSearch";

import { useEffect, useState } from "react";
import { Department } from "@/types";
import { useInvalidate, useLink, useNavigation, useShow } from "@refinedev/core";
import {
  ShowView,
  ShowViewHeader,
} from "@/components/refine-ui/views/show-view.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { StatCard } from "@/components/stat-card.tsx";
import { ClassesTableSection, useInvalidateClassesTableSection } from "@/components/classes-table-section.tsx";
import { PeopleTableSection } from "@/components/people-table-section.tsx";
import { CreateButton } from "@/components/refine-ui/buttons/create.tsx";
import { trackRumEvent } from "@/lib/rum.ts";

const SUBJECTS_PAGE_SIZE = 10;

const Show = () => {
  const { query } = useShow<Department>({ resource: "departments" });
  const { showUrl } = useNavigation();
  const Link = useLink();
  const invalidate = useInvalidate();
  const invalidateClasses = useInvalidateClassesTableSection();

  const department = query.data?.data;
  const { isLoading, isError } = query;
  const departmentId = department?.id;

  useEffect(() => {
    if (department) trackRumEvent("department_detail_query_loaded");
  }, [department]);

  const [visibleSubjects, setVisibleSubjects] = useState(SUBJECTS_PAGE_SIZE);
  useEffect(() => setVisibleSubjects(SUBJECTS_PAGE_SIZE), [departmentId]);

  const refreshEverything = () => {
    if (departmentId) invalidate({ resource: "departments", invalidates: ["detail"], id: departmentId });
    invalidateClasses();
  };

  if (isLoading || isError || !department) {
    return (
      <ShowView className="class-view class-show">
        <ShowViewHeader resource="departments" title="Department Details" breadcrumbLastLabel="Department Details" />
        {isLoading ? (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground -mt-2">
              Full profile for this department, including every subject it currently offers.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
            <Card className="details-card">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-40 w-full rounded-lg" />
              </div>
            </Card>
          </div>
        ) : (
          <p className="state-message">
            {isError ? "failed to load department details..." : "department not found"}
          </p>
        )}
      </ShowView>
    );
  }

  const {
    name,
    code,
    description,
    subjects = [],
    classesCount = 0,
    enrolledCount = 0,
    teachers = [],
    students = [],
  } = department;

  const visibleSubjectRows = subjects.slice(0, visibleSubjects);
  const remainingSubjects = Math.max(subjects.length - visibleSubjectRows.length, 0);

  // No dedicated "classes filtered by department" or "enrollments filtered by
  // department" list-page control exists yet - Classes' own filter popover
  // has no Department option. The href still works (the backend's new
  // departmentId param + /classes' own syncWithLocation pick it up even
  // without a visible filter chip for it), so this is a real filtered view,
  // just not one the Classes page's own UI can construct on its own.
  const classesViewAllHref = `/classes?filters[0][field]=departmentId&filters[0][operator]=eq&filters[0][value]=${departmentId}`;
  const subjectsViewAllHref = `/subjects?filters[0][field]=department&filters[0][operator]=eq&filters[0][value]=${encodeURIComponent(name)}`;

  return (
    <ShowView className="class-view class-show">
      <ShowViewHeader
        resource="departments"
        title="Department Details"
        breadcrumbLastLabel="Department Details"
        onRefresh={refreshEverything}
      />
      <p className="text-sm text-muted-foreground -mt-2">
        Full profile for this department, including every subject it currently offers.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Subjects" value={subjects.length} viewAllHref={subjectsViewAllHref} />
        <StatCard label="Total Classes" value={classesCount} viewAllHref={classesViewAllHref} />
        <StatCard label="Enrolled Students" value={enrolledCount} viewAllHref={classesViewAllHref} />
      </div>

      <Card className="details-card">
        <div className="details-header">
          <div>
            <h1>{name}</h1>
            {description && <p>{description}</p>}
          </div>
          <div>
            <Badge variant="outline">Code: {code}</Badge>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-lg font-semibold">
            Subjects (<span className="tabular-nums">{subjects.length}</span>)
          </p>
          {subjects.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">No subjects yet.</p>
              <CreateButton resource="subjects" variant="default" size="sm">
                Create a subject
              </CreateButton>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border">
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption className="sr-only">Subjects in {name}</TableCaption>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead scope="col">Code</TableHead>
                      <TableHead scope="col">Subject</TableHead>
                      <TableHead scope="col">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleSubjectRows.map((subject, index) => (
                      <TableRow key={subject.id} className={index % 2 === 1 ? "bg-muted/30" : undefined}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">{subject.code}</Badge>
                        </TableCell>
                        <TableCell>
                          <Link
                            to={showUrl("subjects", subject.id)}
                            title={subject.name}
                            className="inline-block max-w-[220px] truncate rounded px-1 py-0.5 -mx-1 font-medium text-foreground hover:text-primary hover:underline focus-visible:text-primary focus-visible:underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {subject.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground line-clamp-1">
                            {subject.description || "—"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {remainingSubjects > 0 && (
            <div className="mt-3 flex justify-center">
              <Button variant="outline" onClick={() => setVisibleSubjects((c) => c + SUBJECTS_PAGE_SIZE)}>
                View more ({remainingSubjects})
              </Button>
            </div>
          )}
        </div>

        <Separator />

        <ClassesTableSection
          filters={[{ field: "departmentId", operator: "eq", value: departmentId }]}
          resetKey={departmentId}
          enabled={!!departmentId}
        />

        <Separator />

        <div className="grid gap-4 lg:grid-cols-2">
          <PeopleTableSection
            title="Teachers"
            people={teachers}
            isLoading={false}
            roleLabel="Teacher"
            linkResource="faculty"
            emptyMessage="No teachers assigned yet."
            resetKey={departmentId}
          />
          <PeopleTableSection
            title="Students"
            people={students}
            isLoading={false}
            roleLabel="Student"
            linkResource="users"
            emptyMessage="No students enrolled yet."
            resetKey={departmentId}
          />
        </div>
      </Card>
    </ShowView>
  );
};

export default Show;

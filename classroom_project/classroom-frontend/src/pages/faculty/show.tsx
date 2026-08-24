import { useMemo } from "react";
import { useParams } from "react-router";
import { UserDetails } from "@/types";
import { useShow } from "@refinedev/core";
import {
  ShowView,
  ShowViewHeader,
} from "@/components/refine-ui/views/show-view.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { ShowButton } from "@/components/refine-ui/buttons/show.tsx";
import { useIsAdmin } from "@/hooks/use-is-admin.ts";
import { ClassStatusBadge } from "@/components/class-status-badge.tsx";
import { DepartmentBadge } from "@/components/department-badge.tsx";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";

const Show = () => {
  // useShow's default id-resolution matches the current URL against the
  // "users" resource's own registered route (/users/show/:id) to find :id -
  // but this page is mounted at /faculty/show/:id, a different pattern, so
  // that match fails silently. Reading :id straight from the actual route
  // sidesteps resource-based matching entirely.
  const { id } = useParams<{ id: string }>();
  const { query } = useShow<UserDetails>({ resource: "users", id });
  const { isAdmin } = useIsAdmin();

  const userDetails = query.data?.data;
  const { isLoading, isError } = query;

  const classesTaught = userDetails?.classesTaught ?? [];

  // One row per department this teacher actually teaches in - the thing
  // "Classes Taught" alone doesn't surface: how many departments, and how
  // much of their load sits in each.
  const departmentBreakdown = useMemo(() => {
    const byDept = new Map<
      string,
      { id: number | string; name: string; classCount: number; subjects: Set<string> }
    >();
    for (const klass of classesTaught) {
      const dept = klass.department;
      if (!dept) continue;
      const key = String(dept.id);
      if (!byDept.has(key)) {
        byDept.set(key, { id: dept.id, name: dept.name, classCount: 0, subjects: new Set() });
      }
      const entry = byDept.get(key)!;
      entry.classCount += 1;
      if (klass.subject?.name) entry.subjects.add(klass.subject.name);
    }
    return [...byDept.values()].sort((a, b) => b.classCount - a.classCount);
  }, [classesTaught]);

  if (isLoading || isError || !userDetails) {
    return (
      <ShowView className="class-view class-show">
        <ShowViewHeader resource="users" title="Profile" breadcrumbLastLabel="Profile" hideEdit={!isAdmin} />

        <p className="state-message">
          {isLoading
            ? "Loading profile..."
            : isError
              ? "failed to load profile..."
              : "faculty member not found"}
        </p>
      </ShowView>
    );
  }

  const { name, email, image } = userDetails;

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const placeholderUrl = `https://placehold.co/200x200?text=${encodeURIComponent(initials || "NA")}`;

  return (
    <ShowView className="class-view class-show">
      <ShowViewHeader resource="users" title="Profile" breadcrumbLastLabel="Profile" hideEdit={!isAdmin} />

      <Card className="details-card">
        <div className="details-header">
          <div className="flex items-center gap-4">
            <img
              src={image ?? placeholderUrl}
              alt={name}
              className="h-16 w-16 rounded-full object-cover"
            />
            <div>
              <h1>{name}</h1>
              <p>{email}</p>
            </div>
          </div>
          <div>
            <Badge variant="secondary">TEACHER</Badge>
          </div>
        </div>

        <Separator />

        <div className="subject">
          <p>Departments ({departmentBreakdown.length})</p>
          {departmentBreakdown.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Not teaching in any department yet.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border">
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption className="sr-only">
                    Departments {name} teaches in
                  </TableCaption>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead scope="col">Department</TableHead>
                      <TableHead scope="col">Subjects</TableHead>
                      <TableHead scope="col" className="text-right">Classes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departmentBreakdown.map((dept, index) => (
                      <TableRow
                        key={dept.id}
                        className={index % 2 === 1 ? "bg-muted/30" : undefined}
                      >
                        <TableCell>
                          <DepartmentBadge name={dept.name} />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {[...dept.subjects].join(", ") || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {dept.classCount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <Separator />

        <div className="subject">
          <p>Classes Taught ({classesTaught.length})</p>
          {classesTaught.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Not teaching any classes yet.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border">
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption className="sr-only">
                    Classes {name} teaches
                  </TableCaption>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead scope="col">Class</TableHead>
                      <TableHead scope="col">Subject</TableHead>
                      <TableHead scope="col">Department</TableHead>
                      <TableHead scope="col">Status</TableHead>
                      <TableHead scope="col" className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classesTaught.map((klass, index) => (
                      <TableRow
                        key={klass.id}
                        className={index % 2 === 1 ? "bg-muted/30" : undefined}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{klass.name}</p>
                            {klass.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {klass.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {klass.subject?.name ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {klass.department ? (
                            <DepartmentBadge name={klass.department.name} />
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ClassStatusBadge status={klass.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <ShowButton
                            resource="classes"
                            recordItemId={klass.id}
                            variant="outline"
                            size="sm"
                          >
                            View
                          </ShowButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </Card>
    </ShowView>
  );
};

export default Show;

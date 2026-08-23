import { ClassDetails, Subject } from "@/types";
import { useLink, useList, useNavigation, useShow } from "@refinedev/core";
import {
  ShowView,
  ShowViewHeader,
} from "@/components/refine-ui/views/show-view.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { DepartmentBadge } from "@/components/department-badge.tsx";

const Show = () => {
  const { query } = useShow<Subject>({ resource: "subjects" });

  const subject = query.data?.data;
  const { isLoading, isError } = query;
  const subjectId = subject?.id;

  // A subject is offered as one or more class sections (e.g. "Section A",
  // "Lab") - this is the browsing path from "what's taught" (Subjects) down
  // to "who's teaching it and when" (Classes), the same relationship
  // Department's show page already exposes one level up (departments ->
  // subjects).
  const { query: classesQuery } = useList<ClassDetails>({
    resource: "classes",
    filters: [{ field: "subjectId", operator: "eq", value: subjectId }],
    pagination: { pageSize: 100 },
    queryOptions: { enabled: !!subjectId },
  });

  const classesForSubject = classesQuery?.data?.data ?? [];

  const { showUrl } = useNavigation();
  const Link = useLink();

  if (isLoading || isError || !subject) {
    return (
      <ShowView className="class-view class-show">
        <ShowViewHeader resource="subjects" title="subject details" hideEdit />

        <p className="state-message">
          {isLoading
            ? "Loading subject details..."
            : isError
              ? "failed to load subject details..."
              : "subject not found"}
        </p>
      </ShowView>
    );
  }

  const { name, code, description, department } = subject;

  return (
    <ShowView className="class-view class-show">
      <ShowViewHeader resource="subjects" title="subject details" hideEdit />

      <Card className="details-card">
        <div className="details-header">
          <div>
            <h1>{name}</h1>
            <p>{description}</p>
          </div>
          <div>
            <Badge variant="outline">Code: {code}</Badge>
            {department && <DepartmentBadge name={department.name} />}
          </div>
        </div>

        <Separator />

        <div className="subject">
          <p>Classes ({classesForSubject.length})</p>
          {classesQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">
              Loading classes...
            </div>
          ) : classesForSubject.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No classes are currently offered for this subject.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {classesForSubject.map((classDetails) => {
                const enrolledCount = classDetails.enrolledCount ?? 0;
                const isFull = enrolledCount >= classDetails.capacity;

                return (
                  <Link
                    key={classDetails.id}
                    to={showUrl("classes", classDetails.id)}
                    className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/50"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{classDetails.name}</span>
                        <Badge
                          variant={classDetails.status === "active" ? "default" : "secondary"}
                        >
                          {classDetails.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {classDetails.teacher?.name ?? "No teacher assigned"}
                      </p>
                    </div>
                    <Badge variant={isFull ? "destructive" : "outline"}>
                      {enrolledCount}/{classDetails.capacity} enrolled
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </ShowView>
  );
};

export default Show;

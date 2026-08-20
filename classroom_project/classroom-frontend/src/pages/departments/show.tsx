import { Department } from "@/types";
import { useShow } from "@refinedev/core";
import {
  ShowView,
  ShowViewHeader,
} from "@/components/refine-ui/views/show-view.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { ShowButton } from "@/components/refine-ui/buttons/show.tsx";

const Show = () => {
  const { query } = useShow<Department>({ resource: "departments" });

  const department = query.data?.data;
  const { isLoading, isError } = query;

  if (isLoading || isError || !department) {
    return (
      <ShowView className="class-view class-show">
        <ShowViewHeader resource="departments" title="department details" />

        <p className="state-message">
          {isLoading
            ? "Loading department details..."
            : isError
              ? "failed to load department details..."
              : "department not found"}
        </p>
      </ShowView>
    );
  }

  const { name, code, description, subjects = [] } = department;

  return (
    <ShowView className="class-view class-show">
      <ShowViewHeader resource="departments" title="department details" />

      <Card className="details-card">
        <div className="details-header">
          <div>
            <h1>{name}</h1>
            <p>{description}</p>
          </div>
          <div>
            <Badge variant="outline">Code: {code}</Badge>
            <Badge variant="secondary">{subjects.length} subjects</Badge>
          </div>
        </div>

        <Separator />

        <div className="subject">
          <p>Subjects</p>
          {subjects.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No subjects assigned to this department yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {subjects.map((subject) => (
                <div
                  key={subject.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{subject.code}</Badge>
                      <span className="font-medium">{subject.name}</span>
                    </div>
                    {subject.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {subject.description}
                      </p>
                    )}
                  </div>
                  <ShowButton
                    resource="subjects"
                    recordItemId={subject.id}
                    variant="outline"
                    size="sm"
                  >
                    View
                  </ShowButton>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </ShowView>
  );
};

export default Show;

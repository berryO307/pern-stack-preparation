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

const ROLE_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  teacher: "secondary",
  student: "outline",
};

const Show = () => {
  const { query } = useShow<UserDetails>({ resource: "users" });
  const { isAdmin } = useIsAdmin();

  const userDetails = query.data?.data;
  const { isLoading, isError } = query;

  if (isLoading || isError || !userDetails) {
    return (
      <ShowView className="class-view class-show">
        <ShowViewHeader resource="users" title="user details" hideEdit={!isAdmin} />

        <p className="state-message">
          {isLoading
            ? "Loading user details..."
            : isError
              ? "failed to load user details..."
              : "user not found"}
        </p>
      </ShowView>
    );
  }

  const { name, email, role, image, classesTaught = [], enrolledClasses = [] } =
    userDetails;

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const placeholderUrl = `https://placehold.co/200x200?text=${encodeURIComponent(initials || "NA")}`;

  return (
    <ShowView className="class-view class-show">
      <ShowViewHeader resource="users" title="user details" hideEdit={!isAdmin} />

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
            <Badge variant={ROLE_BADGE_VARIANT[role] ?? "outline"}>
              {role.toUpperCase()}
            </Badge>
          </div>
        </div>

        {role === "teacher" && (
          <>
            <Separator />
            <div className="subject">
              <p>Classes Taught ({classesTaught.length})</p>
              {classesTaught.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Not teaching any classes yet.
                </div>
              ) : (
                <div className="flex flex-col gap-3 mt-2">
                  {classesTaught.map((klass) => (
                    <div
                      key={klass.id}
                      className="flex items-center justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{klass.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {klass.description}
                        </p>
                      </div>
                      <ShowButton
                        resource="classes"
                        recordItemId={klass.id}
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
          </>
        )}

        {role === "student" && (
          <>
            <Separator />
            <div className="subject">
              <p>Enrolled Classes ({enrolledClasses.length})</p>
              {enrolledClasses.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Not enrolled in any classes yet.
                </div>
              ) : (
                <div className="flex flex-col gap-3 mt-2">
                  {enrolledClasses.map((enrollment) => (
                    <div
                      key={enrollment.id}
                      className="flex items-center justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">
                          {enrollment.class?.name ?? "Unknown class"}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {enrollment.class?.description}
                        </p>
                      </div>
                      {enrollment.class?.id && (
                        <ShowButton
                          resource="classes"
                          recordItemId={enrollment.class.id}
                          variant="outline"
                          size="sm"
                        >
                          View
                        </ShowButton>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </ShowView>
  );
};

export default Show;

import { formatDistanceToNow } from "date-fns";
import { BookOpen, GraduationCap, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import type { RecentActivityItem } from "@/types";

const ACTIVITY_ICON = {
  enrollment: UserPlus,
  class: BookOpen,
  user: GraduationCap,
} as const;

type RecentActivityProps = {
  activity: RecentActivityItem[];
  isLoading: boolean;
};

export function RecentActivity({ activity, isLoading }: RecentActivityProps) {
  const visible = activity.slice(0, 8);

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity yet. Actions across departments and classes will show up here.
          </p>
        ) : (
          <>
            <div className="divide-y divide-border">
              {visible.map((item) => {
                const Icon = ACTIVITY_ICON[item.type];
                return (
                  <div key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{item.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {item.type}
                    </Badge>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 border-t pt-3">
              <a href="/enrollments" className="text-sm font-medium text-primary hover:underline">
                View all activity
              </a>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

RecentActivity.displayName = "RecentActivity";

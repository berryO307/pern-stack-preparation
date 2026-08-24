import { useEffect } from "react";
import { Subject } from "@/types";
import { useInvalidate, useLink, useNavigation, useShow } from "@refinedev/core";
import {
  ShowView,
  ShowViewHeader,
} from "@/components/refine-ui/views/show-view.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { DepartmentBadge } from "@/components/department-badge.tsx";
import { ClassesTableSection, useInvalidateClassesTableSection } from "@/components/classes-table-section.tsx";
import { PeopleTableSection } from "@/components/people-table-section.tsx";
import { buildClassBannerUrl, buildSubjectBannerUrl } from "@/lib/cloudinary.ts";
import { SUBJECT_TINT_HEX_COLORS, hashToTintIndex } from "@/lib/subject-tint.ts";
import { trackRumEvent } from "@/lib/rum.ts";

const Show = () => {
  const { query } = useShow<Subject>({ resource: "subjects" });
  const { showUrl } = useNavigation();
  const Link = useLink();
  const invalidate = useInvalidate();
  const invalidateClasses = useInvalidateClassesTableSection();

  const subject = query.data?.data;
  const { isLoading, isError } = query;
  const subjectId = subject?.id;

  useEffect(() => {
    if (subject) trackRumEvent("subject_detail_query_loaded");
  }, [subject]);

  const refreshEverything = () => {
    if (subjectId) invalidate({ resource: "subjects", invalidates: ["detail"], id: subjectId });
    invalidateClasses();
  };

  if (isLoading || isError || !subject) {
    return (
      <ShowView className="class-view class-show">
        <ShowViewHeader resource="subjects" title="Subject Details" breadcrumbLastLabel="Subject Details" />
        {isLoading ? (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground -mt-2">
              Overview, classes, and the people teaching and studying this subject.
            </p>
            <Skeleton className="aspect-[5/2] w-full rounded-xl sm:aspect-[5/1.4]" />
            <Card className="details-card">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-40 w-full rounded-lg" />
              </div>
            </Card>
          </div>
        ) : (
          <p className="state-message">
            {isError ? "failed to load subject details..." : "subject not found"}
          </p>
        )}
      </ShowView>
    );
  }

  const { name, code, description, department, teachers = [], students = [] } = subject;

  // Real uploaded photo wins; otherwise the same generated colour+caption
  // fallback already used on the class detail page, keyed off the subject's
  // own tint - so this hero is never blank, and matches whatever banner
  // already shows for this subject's classes elsewhere in the app.
  const tintIndex = hashToTintIndex(subject.id);
  const heroSrc = subject.imageCldPubId
    ? buildClassBannerUrl(subject.imageCldPubId)
    : buildSubjectBannerUrl(name, SUBJECT_TINT_HEX_COLORS[tintIndex]!);

  return (
    <ShowView className="class-view class-show">
      <ShowViewHeader
        resource="subjects"
        title="Subject Details"
        breadcrumbLastLabel="Subject Details"
        onRefresh={refreshEverything}
      />
      <p className="text-sm text-muted-foreground -mt-2">
        Overview, classes, and the people teaching and studying this subject.
      </p>

      {/* Hero: the subject's own banner as a soft background rather than a
          loud photo block - a gradient fades it into the page's own surface
          color at the bottom, so the name/code/department sit on solid
          ground (no white/black text-shadow tricks needed) while the top of
          the image still reads clearly. */}
      <div className="relative overflow-hidden rounded-xl">
        <img
          src={heroSrc}
          alt=""
          loading="lazy"
          className="aspect-[5/2] w-full object-cover sm:aspect-[5/1.4]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-background/80">Code: {code}</Badge>
            {department && <DepartmentBadge name={department.name} />}
          </div>
        </div>
      </div>

      <Card className="details-card">
        {/* Overview: this schema has one description field, not a separate
            short/long pair - render it in full prose here rather than the
            bare line the page used to show under the name. */}
        <div className="rounded-lg border overflow-hidden">
          <div className="bg-muted/50 px-4 py-2">
            <p className="text-sm font-medium">Overview</p>
          </div>
          <div className="p-4">
            {description ? (
              <p className="text-sm leading-relaxed max-w-prose">{description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No overview available.</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Compact definition list, not a redundant single-row table - it
            would just repeat the name/description already shown above. */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">Subject</p>
          <dl className="grid gap-3 sm:grid-cols-2 rounded-lg bg-muted/50 p-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Code</dt>
              <dd className="mt-0.5 font-mono">
                <Badge variant="outline" className="font-mono">{code}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Department</dt>
              <dd className="mt-0.5">
                {department ? (
                  <Link to={showUrl("departments", department.id)} className="hover:underline">
                    {department.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <Separator />

        <ClassesTableSection
          filters={[{ field: "subjectId", operator: "eq", value: subjectId }]}
          resetKey={subjectId}
          enabled={!!subjectId}
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
            resetKey={subjectId}
          />
          <PeopleTableSection
            title="Students"
            people={students}
            isLoading={false}
            roleLabel="Student"
            linkResource="users"
            emptyMessage="No students enrolled yet."
            resetKey={subjectId}
          />
        </div>
      </Card>
    </ShowView>
  );
};

export default Show;

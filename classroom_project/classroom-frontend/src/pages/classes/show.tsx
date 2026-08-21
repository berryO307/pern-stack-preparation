import React, { useState } from "react";
import { ClassDetails, Enrollment, User } from "@/types";
import {
  useCreate,
  useDelete,
  useInvalidate,
  useList,
  useShow,
} from "@refinedev/core";
import {
  ShowView,
  ShowViewHeader,
} from "@/components/refine-ui/views/show-view.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { AdvancedImage } from "@cloudinary/react";
import { bannerPhoto } from "@/lib/cloudinary.ts";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils.ts";

const Show = () => {
  const { query } = useShow<ClassDetails>({ resource: "classes" });

  const classDetails = query.data?.data;
  const { isLoading, isError } = query;
  const classId = classDetails?.id;

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [unenrollingId, setUnenrollingId] = useState<number | null>(null);

  const invalidate = useInvalidate();

  const { query: enrollmentsQuery } = useList<Enrollment>({
    resource: "enrollments",
    filters: [{ field: "classId", operator: "eq", value: classId }],
    // Matches the studentsQuery cap below — without this the roster (and the
    // "Enrolled Students (N)" count derived from it) silently truncates at
    // the default page size of 10, diverging from the accurate server-side
    // enrolledCount shown in the capacity badge above.
    pagination: { pageSize: 100 },
    queryOptions: { enabled: !!classId },
  });

  const { query: studentsQuery } = useList<User>({
    resource: "users",
    filters: [{ field: "role", operator: "eq", value: "student" }],
    pagination: { pageSize: 100 },
  });

  const { mutate: enrollStudent, mutation: enrollMutation } = useCreate();
  const { mutate: deleteEnrollment } = useDelete();

  const enrollments = enrollmentsQuery?.data?.data ?? [];
  const students = studentsQuery?.data?.data ?? [];
  const enrolledStudentIds = new Set(enrollments.map((e) => e.studentId));
  const availableStudents = students.filter(
    (student) => !enrolledStudentIds.has(student.id),
  );

  const invalidateClassDetail = () => {
    if (!classId) return;
    invalidate({ resource: "classes", invalidates: ["detail"], id: classId });
  };

  const handleEnroll = () => {
    if (!selectedStudentId || !classId) return;

    enrollStudent(
      {
        resource: "enrollments",
        values: { classId, studentId: selectedStudentId },
      },
      {
        onSuccess: () => {
          setSelectedStudentId("");
          invalidateClassDetail();
        },
      },
    );
  };

  const handleUnenroll = (enrollmentId: number) => {
    setUnenrollingId(enrollmentId);
    deleteEnrollment(
      { resource: "enrollments", id: enrollmentId },
      {
        onSuccess: invalidateClassDetail,
        onSettled: () => setUnenrollingId(null),
      },
    );
  };

  if (isLoading || isError || !classDetails) {
    return (
      <ShowView className="class-view class-show">
        <ShowViewHeader resource="classes" title="class details" />

        <p className="state-message">
          {isLoading
            ? "Loading class details..."
            : isError
              ? "failed to load class details..."
              : "class details not found"}
        </p>
      </ShowView>
    );
  }

  const teacherName = classDetails.teacher?.name ?? "Unknow";
  const teachersInitials = teacherName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join(" ");

  const placeholderUrl = `https://placehold.co/600*400?text=${encodeURIComponent(teachersInitials || "NA")}`;

  const {
    name,
    description,
    status,
    capacity,
    enrolledCount = 0,
    bannerUrl,
    bannerCldPubId,
    subject,
    teacher,
    department,
  } = classDetails;

  const isFull = enrolledCount >= capacity;
  const isNearCapacity = !isFull && enrolledCount / capacity >= 0.8;

  return (
    <ShowView className="class-view class-show">
      <ShowViewHeader resource="classes" title="class details" />
      <div className="banner">
        {bannerCldPubId ? (
          <AdvancedImage
            alt="class Banner"
            cldImg={bannerPhoto(bannerCldPubId, name)}
          />
        ) : bannerUrl ? (
          <img src={bannerUrl} alt="class Banner" />
        ) : (
          <div className="placeholder" />
        )}
      </div>
      <Card className="details-card">
        <div className="details-header">
          <div>
            <h1>{name}</h1>
            <p>{description}</p>
          </div>
        </div>

        <div>
          <Badge
            variant={isFull ? "destructive" : "outline"}
            className={cn(
              isNearCapacity &&
                "border-amber-500 text-amber-600 dark:text-amber-400",
            )}
          >
            {enrolledCount}/{capacity} enrolled
            {isFull ? " · FULL" : isNearCapacity ? " · Almost full" : ""}
          </Badge>
          <Badge
            variant={status === "active" ? "default" : "secondary"}
            data-status={status}
          >
            {status.toUpperCase()}
          </Badge>
        </div>
        <div className="details-grid">
          <div className="instructor">
            <p> Instructor</p>
            <div>
              <img src={teacher?.image ?? placeholderUrl} alt={teacherName} />
              <div>
                <p> {teacherName}</p>
                <p>{teacher?.email}</p>
              </div>
            </div>
          </div>
          <div>
            <p>{department?.name}</p>
            <p>{department?.description}</p>
          </div>
        </div>
        <Separator />

        <div className="subject">
          <p>Subject</p>
          <div>
            <Badge variant="outline">Code: {subject?.code}</Badge>
            <p>{subject?.name}</p>
            <p>{subject?.description}</p>
          </div>
        </div>

        <Separator />

        <div className="enrollments">
          <div className="flex items-center justify-between">
            <p>Enrolled Students ({enrollments.length})</p>
            {classDetails.inviteCode && (
              <Badge variant="outline">Invite code: {classDetails.inviteCode}</Badge>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <Select
              value={selectedStudentId}
              onValueChange={setSelectedStudentId}
              disabled={isFull || studentsQuery.isLoading}
            >
              <SelectTrigger className="w-full sm:flex-1">
                <SelectValue
                  placeholder={
                    isFull
                      ? "Class is at full capacity"
                      : "Select a student to enroll"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableStudents.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No students available to enroll
                  </SelectItem>
                ) : (
                  availableStudents.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name} ({student.email})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={handleEnroll}
              disabled={!selectedStudentId || isFull || enrollMutation.isPending}
              aria-label={enrollMutation.isPending ? "Enrolling..." : undefined}
            >
              {enrollMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Enroll"
              )}
            </Button>
          </div>

          {enrollmentsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground mt-4">
              Loading enrolled students...
            </p>
          ) : enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">
              No students enrolled yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3 mt-4">
              {enrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="space-y-1">
                    <p className="font-medium">
                      {enrollment.student?.name ?? "Unknown student"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {enrollment.student?.email}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={unenrollingId === enrollment.id}
                    onClick={() => handleUnenroll(enrollment.id)}
                    aria-label={unenrollingId === enrollment.id ? "Unenrolling..." : undefined}
                  >
                    {unenrollingId === enrollment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Unenroll"
                    )}
                  </Button>
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

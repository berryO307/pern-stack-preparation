import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  useCreate,
  useDelete,
  useGetIdentity,
  useInvalidate,
  useLink,
  useList,
  useNavigation,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Check, Copy, Loader2 } from "lucide-react";
import { PersonCell } from "@/components/person-cell.tsx";
import { ClassStatusBadge } from "@/components/class-status-badge.tsx";
import { buildAvatarSrc, buildClassBannerUrl, buildSubjectBannerUrl } from "@/lib/cloudinary.ts";
import { SUBJECT_TINT_HEX_COLORS, hashToTintIndex } from "@/lib/subject-tint.ts";
import { cn } from "@/lib/utils.ts";
import type { ClassDetails, Enrollment, User } from "@/types";
import { useIsAdmin } from "@/hooks/use-is-admin.ts";
import { trackRumEvent, reportRumError } from "@/lib/rum.ts";

const ROSTER_PAGE_SIZE = 10;

type Identity = { id?: string; email?: string };

const Show = () => {
  const { query } = useShow<ClassDetails>({ resource: "classes" });
  const classDetails = query.data?.data;
  const { isLoading, isError } = query;
  const classId = classDetails?.id;
  const status = classDetails?.status;

  const { isAdmin } = useIsAdmin();
  const { showUrl } = useNavigation();
  const Link = useLink();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { data: identity, isLoading: identityLoading } = useGetIdentity<Identity>();
  const isSignedIn = !identityLoading && !!identity?.id;

  // ---- Roster: 10 at a time, "View more" fetches and appends the next
  // server page rather than hiding rows already in the browser. "Enrolled"
  // here means status=active specifically - the same definition the
  // heading count and the capacity check both use, so there's exactly one
  // definition of "enrolled" on this whole page (see the count-mismatch
  // fix below).
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterStudents, setRosterStudents] = useState<Enrollment[]>([]);

  useEffect(() => {
    setRosterPage(1);
    setRosterStudents([]);
  }, [classId]);

  const { query: rosterQuery } = useList<Enrollment>({
    resource: "enrollments",
    filters: [
      { field: "classId", operator: "eq", value: classId },
      { field: "status", operator: "eq", value: "active" },
    ],
    pagination: { currentPage: rosterPage, pageSize: ROSTER_PAGE_SIZE },
    queryOptions: { enabled: !!classId },
  });

  useEffect(() => {
    const page = rosterQuery.data?.data;
    if (!page) return;
    setRosterStudents((prev) => {
      if (rosterPage === 1) return page;
      const seen = new Set(prev.map((e) => e.id));
      return [...prev, ...page.filter((e) => !seen.has(e.id))];
    });
    trackRumEvent(rosterPage === 1 ? "class_roster_query" : "class_roster_view_more");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterQuery.dataUpdatedAt]);

  const rosterTotal = rosterQuery.data?.total ?? 0;
  const remainingCount = Math.max(rosterTotal - rosterStudents.length, 0);
  const hasMoreRoster = remainingCount > 0;

  // ---- Already-enrolled check for the Join Class button.
  const { query: myEnrollmentQuery } = useList<Enrollment>({
    resource: "enrollments",
    filters: [
      { field: "classId", operator: "eq", value: classId },
      { field: "studentId", operator: "eq", value: identity?.id },
      { field: "status", operator: "eq", value: "active" },
    ],
    pagination: { pageSize: 1 },
    queryOptions: { enabled: !!classId && !!identity?.id },
  });
  const isAlreadyEnrolled = (myEnrollmentQuery.data?.total ?? 0) > 0;

  // ---- Admin "enroll a student directly" - a different capability from
  // self-join (an admin enrolling someone else), kept but demoted to a
  // secondary control inside this section rather than the page's primary
  // action. Needs its own full active-roster fetch (student IDs only) to
  // exclude already-enrolled students, independent of the paginated
  // display roster above.
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const { query: allActiveEnrollmentsQuery } = useList<Enrollment>({
    resource: "enrollments",
    filters: [
      { field: "classId", operator: "eq", value: classId },
      { field: "status", operator: "eq", value: "active" },
    ],
    pagination: { pageSize: 100 },
    queryOptions: { enabled: isAdmin && !!classId },
  });
  const { query: studentsQuery } = useList<User>({
    resource: "users",
    filters: [{ field: "role", operator: "eq", value: "student" }],
    pagination: { pageSize: 100 },
    queryOptions: { enabled: isAdmin },
  });
  const enrolledStudentIds = new Set(
    (allActiveEnrollmentsQuery.data?.data ?? []).map((e) => e.studentId),
  );
  const availableStudents = (studentsQuery.data?.data ?? []).filter(
    (s) => !enrolledStudentIds.has(s.id),
  );

  const { mutate: enrollStudent, mutation: enrollMutation } = useCreate();
  const { mutate: deleteEnrollment } = useDelete();

  const invalidateClassDetail = () => {
    if (!classId) return;
    invalidate({ resource: "classes", invalidates: ["detail"], id: classId });
  };

  const refreshEverything = () => {
    invalidateClassDetail();
    invalidate({ resource: "enrollments", invalidates: ["list"] });
  };

  const handleAdminEnroll = () => {
    if (!selectedStudentId || !classId) return;
    enrollStudent(
      { resource: "enrollments", values: { classId, studentId: selectedStudentId } },
      {
        onSuccess: () => {
          setSelectedStudentId("");
          setRosterPage(1);
          setRosterStudents([]);
          refreshEverything();
        },
        onError: (error) => {
          reportRumError(`Admin enroll failed (status ${error?.statusCode ?? "unknown"}): ${error?.message ?? "unknown error"}`);
        },
      },
    );
  };

  const [unenrollTarget, setUnenrollTarget] = useState<Enrollment | null>(null);
  const [unenrolling, setUnenrolling] = useState(false);

  const handleUnenroll = () => {
    if (!unenrollTarget) return;
    const target = unenrollTarget;
    setUnenrolling(true);
    // Optimistic: gone from the roster immediately, restored on failure.
    setRosterStudents((prev) => prev.filter((e) => e.id !== target.id));
    deleteEnrollment(
      { resource: "enrollments", id: target.id },
      {
        onSuccess: () => {
          setUnenrollTarget(null);
          setUnenrolling(false);
          refreshEverything();
        },
        onError: (error) => {
          setRosterStudents((prev) => [target, ...prev]);
          setUnenrollTarget(null);
          setUnenrolling(false);
          reportRumError(`Unenroll failed (status ${error?.statusCode ?? "unknown"}): ${error?.message ?? "unknown error"}`);
        },
      },
    );
  };

  const [codeCopied, setCodeCopied] = useState(false);
  const handleCopyCode = async () => {
    if (!classDetails?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(classDetails.inviteCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Clipboard access denied/unsupported - the code is still visible to
      // copy by hand, so this is a silent no-op, not an error state.
    }
  };

  if (isLoading) {
    return (
      <ShowView className="class-view class-show">
        <ShowViewHeader resource="classes" title="Class Details" breadcrumbLastLabel="Class Detail" hideEdit />
        <p className="text-sm text-muted-foreground -mt-2">
          Class information, enrollment details, and the code students use to join.
        </p>
        <Skeleton className="mt-5 h-72 w-full rounded-xl" />
        <Card className="details-card">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-96" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </Card>
      </ShowView>
    );
  }

  if (isError || !classDetails) {
    return (
      <ShowView className="class-view class-show">
        <ShowViewHeader resource="classes" title="Class Details" breadcrumbLastLabel="Class Detail" hideEdit />
        <p className="state-message is-error">
          {isError ? "Failed to load class details." : "Class not found."}
        </p>
      </ShowView>
    );
  }

  const {
    name,
    description,
    capacity,
    enrolledCount = 0,
    bannerCldPubId,
    subject,
    teacher,
    department,
    inviteCode,
  } = classDetails;

  // Priority: this class's own uploaded banner, then its subject's uploaded
  // image (this was the actual bug - the fallback chain used on the
  // Classes list never made it onto this page, so a subject image uploaded
  // via its edit form showed on the list but not here), then a generated
  // banner so every class with a subject shows something real regardless
  // of whether anyone has uploaded a photo yet.
  const subjectTintIndex = subject ? hashToTintIndex(subject.id) : 0;
  const bannerSrc = bannerCldPubId
    ? buildClassBannerUrl(bannerCldPubId)
    : subject?.imageCldPubId
      ? buildClassBannerUrl(subject.imageCldPubId)
      : subject
        ? buildSubjectBannerUrl(subject.name, SUBJECT_TINT_HEX_COLORS[subjectTintIndex]!)
        : undefined;
  const isFull = enrolledCount >= capacity;
  const isArchived = status === "archived";
  const isInactive = status === "inactive";

  // Precedence order matters: "Class full" on an archived class is
  // technically true and completely unhelpful, so the status gates run
  // first and win outright.
  const joinState = isArchived
    ? { disabled: true, label: "Class archived", reason: "Archived classes are historical records - no one can join them." }
    : isInactive
      ? { disabled: true, label: "Enrollment closed", reason: "This class isn't currently open for enrollment." }
      : !isSignedIn
        ? { disabled: false, label: "Sign in to join", reason: undefined }
        : isAlreadyEnrolled
          ? { disabled: true, label: "Already enrolled", reason: "You're already on this class's roster." }
          : isFull
            ? { disabled: true, label: "Class full", reason: "This class has reached its capacity." }
            : { disabled: false, label: "Join Class", reason: undefined };

  return (
    <ShowView className="class-view class-show">
      <ShowViewHeader
        resource="classes"
        title="Class Details"
        breadcrumbLastLabel="Class Detail"
        onRefresh={refreshEverything}
      />
      <p className="text-sm text-muted-foreground -mt-2">
        Class information, enrollment details, and the code students use to join.
      </p>

      <div className="banner">
        {bannerSrc ? (
          <img
            src={bannerSrc}
            alt=""
            loading="lazy"
            width={1600}
            height={320}
          />
        ) : (
          <div className="placeholder" />
        )}
      </div>

      <Card className="details-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold">{name}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <ClassStatusBadge status={status} />
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2 text-sm">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Instructor</p>
            <div className="rounded-lg bg-muted/50 p-4">
              {teacher ? (
                <PersonCell
                  name={teacher.name}
                  avatarSrc={buildAvatarSrc(teacher.imageCldPubId, teacher.image)}
                />
              ) : (
                <span className="text-muted-foreground">No instructor assigned</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Department</p>
            <div className="rounded-lg bg-muted/50 p-4 space-y-1">
              {department ? (
                <>
                  <p className="font-medium">{department.name}</p>
                  <p className="text-sm text-muted-foreground">{department.description}</p>
                </>
              ) : (
                <span className="text-muted-foreground">No department on record</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Subject</p>
            <div className="rounded-lg bg-muted/50 p-4 space-y-1">
              {subject ? (
                <>
                  <p className="font-medium">{subject.name}</p>
                  <Badge variant="outline">{subject.code}</Badge>
                  <p className="text-sm text-muted-foreground">{subject.description}</p>
                </>
              ) : (
                <span className="text-muted-foreground">No subject on record</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Class code</p>
            <div className="rounded-lg bg-muted/50 p-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg tracking-wide">{inviteCode}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Copy class code"
                  onClick={handleCopyCode}
                >
                  {codeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Copy this code to join the class.</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Join Class</h2>

          {!isArchived && (
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1.5 mt-2">
              <li>Ask your teacher for the invite code.</li>
              <li>Click on &quot;Join Class&quot; below.</li>
              <li>Paste the code and click &quot;Join&quot;.</li>
            </ol>
          )}

          <div className="mt-3 space-y-1.5">
            <Button
              size="lg"
              className="w-full"
              disabled={joinState.disabled}
              onClick={() => {
                if (joinState.label === "Sign in to join") {
                  navigate(`/login?redirect=${encodeURIComponent(`/classes/show/${classId}`)}`);
                  return;
                }
                if (!joinState.disabled) navigate(`/enrollments/create?classId=${classId}`);
              }}
            >
              {joinState.label}
            </Button>
            {joinState.reason && (
              <p className="text-sm text-muted-foreground">{joinState.reason}</p>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-lg font-semibold">
            Enrolled Students (<span className="tabular-nums">{enrolledCount}/{capacity}</span>)
          </p>

          {rosterStudents.length === 0 && !rosterQuery.isLoading ? (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">No students enrolled yet.</p>
              {!joinState.disabled && joinState.label === "Join Class" && (
                <Button asChild size="sm">
                  <Link to={`/enrollments/create?classId=${classId}`}>Join Class</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border">
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption className="sr-only">
                    Students enrolled in {name}
                  </TableCaption>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead scope="col" className="w-[240px]">Name</TableHead>
                      <TableHead scope="col">Email</TableHead>
                      <TableHead scope="col">Role</TableHead>
                      <TableHead scope="col" className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rosterQuery.isLoading && rosterStudents.length === 0
                      ? Array.from({ length: ROSTER_PAGE_SIZE }).map((_, i) => (
                          <TableRow key={`skeleton-${i}`}>
                            <TableCell colSpan={4}>
                              <Skeleton className="h-8 w-full" />
                            </TableCell>
                          </TableRow>
                        ))
                      : rosterStudents.map((enrollment, index) => {
                          const student = enrollment.student;
                          return (
                            <TableRow
                              key={enrollment.id}
                              className={index % 2 === 1 ? "bg-muted/30" : undefined}
                            >
                              <TableCell>
                                {student ? (
                                  <Link to={showUrl("users", student.id)} className="inline-block">
                                    <PersonCell
                                      name={student.name}
                                      avatarSrc={buildAvatarSrc(student.imageCldPubId, student.image)}
                                    />
                                  </Link>
                                ) : (
                                  <span className="text-muted-foreground">Unknown student</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">{student?.email}</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">Student</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isArchived}
                                  title={isArchived ? "This class is archived - its roster is read-only." : undefined}
                                  onClick={() => setUnenrollTarget(enrollment)}
                                >
                                  Unenroll
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {hasMoreRoster && (
            <div className="mt-3 flex justify-center">
              <Button
                variant="outline"
                disabled={rosterQuery.isFetching}
                onClick={() => setRosterPage((p) => p + 1)}
              >
                {rosterQuery.isFetching ? (
                  <span className="flex items-center gap-2">
                    Loading...
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </span>
                ) : (
                  `View more (${remainingCount})`
                )}
              </Button>
            </div>
          )}

          {isAdmin && !isArchived && (
            <div className="mt-4 space-y-2 border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground">
                Admin: enroll a student directly
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select
                  value={selectedStudentId}
                  onValueChange={setSelectedStudentId}
                  disabled={isFull || studentsQuery.isLoading}
                >
                  <SelectTrigger className="w-full sm:flex-1">
                    <SelectValue
                      placeholder={isFull ? "Class is at full capacity" : "Select a student to enroll"}
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
                  onClick={handleAdminEnroll}
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
            </div>
          )}
        </div>
      </Card>

      <AlertDialog open={!!unenrollTarget} onOpenChange={(open) => !open && setUnenrollTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unenroll {unenrollTarget?.student?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll be removed from this class&apos;s roster. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn("bg-destructive text-white hover:bg-destructive/90")}
              disabled={unenrolling}
              onClick={handleUnenroll}
            >
              Unenroll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ShowView>
  );
};

export default Show;

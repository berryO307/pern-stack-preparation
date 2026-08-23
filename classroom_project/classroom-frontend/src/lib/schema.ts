import * as z from "zod";

export const facultySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "teacher", "student"], {
    required_error: "Please select a role",
  }),
  department: z.string(),
  image: z.string().optional(),
  imageCldPubId: z.string().optional(),
});

export const departmentSchema = z.object({
  name: z.string().min(2, "Department name must be at least 2 characters"),
  code: z
    .string()
    .min(2, "Department code must be at least 2 characters")
    .max(50, "Department code must be at most 50 characters"),
  description: z.string().optional().nullable(),
});

export const userSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "teacher", "student"], {
    required_error: "Please select a role",
  }),
  image: z.string().optional().nullable(),
  imageCldPubId: z.string().optional().nullable(),
});

export const subjectSchema = z.object({
  name: z.string().min(3, "Subject name must be at least 3 characters"),
  code: z.string().min(2, "Subject code must be at least 2 characters"),
  description: z.string().optional().nullable(),
  departmentId: z.coerce
    .number({
      required_error: "Department is required",
      invalid_type_error: "Department is required",
    })
    .min(1, "Department is required"),
  imageUrl: z.string().optional().nullable(),
  imageCldPubId: z.string().optional().nullable(),
});

const scheduleSchema = z.object({
  day: z.string().min(1, "Day is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
});

export const classSchema = z.object({
  name: z
    .string()
    .min(2, "Class name must be at least 2 characters")
    .max(50, "Class name must be at most 50 characters"),
  description: z
    .string({ required_error: "Description is required" })
    .min(5, "Description must be at least 5 characters"),
  subjectId: z.coerce
    .number({
      required_error: "Subject is required",
      invalid_type_error: "Subject is required",
    })
    .min(1, "Subject is required"),
  teacherId: z.string().min(1, "Teacher is required"),
  capacity: z.coerce
    .number({
      required_error: "Capacity is required",
      invalid_type_error: "Capacity is required",
    })
    .min(1, "Capacity must be at least 1"),
  status: z.enum(["active", "inactive"]),
  bannerUrl: z
    .string({ required_error: "Class banner is required" })
    .min(1, "Class banner is required"),
  bannerCldPubId: z
    .string({ required_error: "Banner reference is required" })
    .min(1, "Banner reference is required"),
  inviteCode: z.string().optional(),
  schedules: z.array(scheduleSchema).optional(),
});

// Client-side is format-only for the invite code - the real (server-side)
// check is whether the code is actually valid, and shipping the set of
// valid codes to the browser to check against would make that check
// decorative. See routes/enrollments.ts for the authoritative chain.
export const INVITE_CODE_REGEX = /^[A-Z]{3}[0-9]{3}$/;

export const enrollmentSchema = z.object({
  classId: z.coerce
    .number({
      required_error: "Select a class",
      invalid_type_error: "Select a class",
    })
    .min(1, "Select a class"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .transform((value) => value.trim().toLowerCase()),
  inviteCode: z
    .string()
    .min(1, "Invite code is required")
    .regex(INVITE_CODE_REGEX, "Codes are 3 letters followed by 3 digits, like CSE101."),
});

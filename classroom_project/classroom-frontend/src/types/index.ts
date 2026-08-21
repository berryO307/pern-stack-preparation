export type Subject = {
  id: number;
  name: string;
  code: string;
  description: string;
  department: string;
  createdAt?: string;
};

export type ListResponse<T = unknown> = {
  data?: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CreateResponse<T = unknown> = {
  data?: T;
};

export type GetOneResponse<T = unknown> = {
  data?: T;
};

declare global {
  interface CloudinaryUploadWidgetResults {
    event: string;
    info: {
      secure_url: string;
      public_id: string;
      delete_token?: string;
      resource_type: string;
      original_filename: string;
    };
  }

  interface CloudinaryWidget {
    open: () => void;
  }

  interface Window {
    cloudinary?: {
      createUploadWidget: (
        options: Record<string, unknown>,
        callback: (
          error: unknown,
          result: CloudinaryUploadWidgetResults,
        ) => void,
      ) => CloudinaryWidget;
    };
    // Site24x7 RUM beacon command queue (loaded async in index.html). Real,
    // documented methods only — see lib/rum.ts for why this is a short list
    // (and for why "addEvent"/"trackEvents" are here despite being missing
    // from the primary API reference page).
    s247r?: {
      (command: "userId", value: string): void;
      (command: "captureException", value: Error): void;
      (command: "endCurrentSession"): void;
      (command: "trackEvents", value: boolean): void;
      (command: "addEvent", value: string): void;
    };
  }
}

export interface UploadWidgetValue {
  url: string;
  publicId: string;
}

export interface UploadWidgetProps {
  value?: UploadWidgetValue | null;
  onChange?: (value: UploadWidgetValue | null) => void;
  disabled?: boolean;
  label?: string;
  previewAlt?: string;
}

export enum UserRole {
  STUDENT = "student",
  TEACHER = "teacher",
  ADMIN = "admin",
}

export type User = {
  id: string;
  createdAt: string;
  updatedAt: string;
  email: string;
  name: string;
  role: UserRole;
  image?: string;
  imageCldPubId?: string;
  department?: string;
};

export type Schedule = {
  day: string;
  startTime: string;
  endTime: string;
};

export type Department = {
  id: number;
  name: string;
  code: string;
  description?: string;
  subjectCount?: number;
  subjects?: Subject[];
  createdAt?: string;
  updatedAt?: string;
};

export type Class = {
  id: number;
  name: string;
  description?: string;
  status: "active" | "inactive" | "archived";
  capacity: number;
  bannerUrl?: string;
  bannerCldPubId?: string;
  inviteCode?: string;
  subject?: Subject;
  teacher?: User;
  createdAt?: string;
  updatedAt?: string;
};

export type ClassDetails = {
  id: number;
  name: string;
  description: string;
  status: "active" | "inactive";
  capacity: number;
  enrolledCount?: number;
  courseCode: string;
  courseName: string;
  bannerUrl?: string;
  bannerCldPubId?: string;
  subject?: Subject;
  teacher?: User;
  department?: Department;
  schedules: Schedule[];
  inviteCode?: string;
};

export type Enrollment = {
  id: number;
  studentId: string;
  classId: number;
  workspaceId?: string;
  student?: User;
  class?: Class;
  createdAt?: string;
  updatedAt?: string;
};

export type UserDetails = User & {
  classesTaught?: Class[];
  enrolledClasses?: Enrollment[];
};

// Mirrors classroom-backend/src/routes/dashboard.ts's `DashboardSummary` type —
// keep both in sync when either side changes shape.
export type DashboardKpi = {
  value: number;
  previous: number;
  deltaPct: number | null;
};

export type CapacityBucket = {
  bucket: "0-20" | "21-40" | "41-60" | "61-80" | "81-100";
  classes: number;
};

export type FillRatePoint = {
  month: string;
  selected: number | null;
  institution: number | null;
};

export type RecentActivityItem = {
  id: string;
  type: "enrollment" | "class" | "user";
  actor: string;
  message: string;
  at: string;
};

export type DashboardSummary = {
  kpis: {
    students: DashboardKpi;
    faculty: DashboardKpi;
    classes: DashboardKpi;
    subjects: DashboardKpi;
  };
  capacityDistribution: CapacityBucket[];
  capacityExcluded: number;
  fillRateDepartmentId: number | null;
  fillRateTrend: FillRatePoint[];
  recentActivity: RecentActivityItem[];
};

export type SignUpPayload = {
  email: string;
  name: string;
  password: string;
  image?: string;
  imageCldPubId?: string;
  role: UserRole;
};

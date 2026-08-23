CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'waitlisted', 'dropped');--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "status" "enrollment_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "demo_workspaces" ADD COLUMN "seed_value" integer;
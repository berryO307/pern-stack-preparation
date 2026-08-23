CREATE TYPE "public"."origin" AS ENUM('seed', 'user');--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "origin" "origin" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "origin" "origin" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "origin" "origin" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "origin" "origin" DEFAULT 'user' NOT NULL;--> statement-breakpoint
CREATE INDEX "classes_workspace_id_origin_idx" ON "classes" USING btree ("workspace_id","origin");--> statement-breakpoint
CREATE INDEX "departments_workspace_id_origin_idx" ON "departments" USING btree ("workspace_id","origin");--> statement-breakpoint
CREATE INDEX "enrollments_workspace_id_origin_idx" ON "enrollments" USING btree ("workspace_id","origin");--> statement-breakpoint
CREATE INDEX "subjects_workspace_id_origin_idx" ON "subjects" USING btree ("workspace_id","origin");
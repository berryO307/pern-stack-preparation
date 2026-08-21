-- Every remaining department/subject/class/enrollment row predates the demo
-- workspace model and has no workspace to backfill into, so the NOT NULL
-- workspace_id columns below can't be added without first clearing the
-- tables. Agreed with the project owner ahead of this migration - the
-- classroom's demo data is regenerated per-workspace by seedWorkspace().
TRUNCATE TABLE "departments", "subjects", "classes", "enrollments" RESTART IDENTITY CASCADE;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "workspace_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "workspace_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "workspace_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "workspace_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_workspace_id_demo_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."demo_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_workspace_id_demo_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."demo_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_workspace_id_demo_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."demo_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_workspace_id_demo_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."demo_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classes_workspace_id_idx" ON "classes" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "classes_workspace_id_invite_code_unique" ON "classes" USING btree ("workspace_id","invite_code");--> statement-breakpoint
CREATE INDEX "departments_workspace_id_idx" ON "departments" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_workspace_id_code_unique" ON "departments" USING btree ("workspace_id","code");--> statement-breakpoint
CREATE INDEX "enrollments_workspace_id_idx" ON "enrollments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "subjects_workspace_id_idx" ON "subjects" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_workspace_id_code_unique" ON "subjects" USING btree ("workspace_id","code");
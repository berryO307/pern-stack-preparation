CREATE INDEX "classes_created_at_idx" ON "classes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "departments_created_at_idx" ON "departments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "enrollments_created_at_idx" ON "enrollments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "enrollments_class_id_created_at_idx" ON "enrollments" USING btree ("class_id","created_at");--> statement-breakpoint
CREATE INDEX "subjects_created_at_idx" ON "subjects" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "subjects_department_id_idx" ON "subjects" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "user_created_at_idx" ON "user" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");
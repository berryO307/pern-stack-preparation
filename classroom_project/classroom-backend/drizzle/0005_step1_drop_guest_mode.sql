CREATE TABLE "demo_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"is_permanent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"seeded_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "classes" DROP CONSTRAINT "classes_invite_code_unique";--> statement-breakpoint
ALTER TABLE "departments" DROP CONSTRAINT "departments_code_unique";--> statement-breakpoint
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_code_unique";--> statement-breakpoint
ALTER TABLE "classes" DROP CONSTRAINT "classes_created_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "departments" DROP CONSTRAINT "departments_created_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_created_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_created_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "demo_workspaces" ADD CONSTRAINT "demo_workspaces_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "demo_workspaces_user_id_unique" ON "demo_workspaces" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "classes" DROP COLUMN "created_by";--> statement-breakpoint
ALTER TABLE "departments" DROP COLUMN "created_by";--> statement-breakpoint
ALTER TABLE "enrollments" DROP COLUMN "created_by";--> statement-breakpoint
ALTER TABLE "subjects" DROP COLUMN "created_by";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "is_anonymous";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "write_count";
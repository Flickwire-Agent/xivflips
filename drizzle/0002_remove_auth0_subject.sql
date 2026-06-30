DROP INDEX IF EXISTS "users_auth0_subject_idx";
--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "auth0_subject" TO "subject";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_auth0_subject_unique";
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_subject_unique" UNIQUE("subject");
--> statement-breakpoint
CREATE INDEX "users_subject_idx" ON "users" USING btree ("subject");

CREATE TABLE "xivauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"xivauth_user_id" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xivauth_accounts_xivauth_user_id_unique" UNIQUE("xivauth_user_id")
);
--> statement-breakpoint
CREATE TABLE "xivauth_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"persistent_key" text NOT NULL,
	"lodestone_id" integer NOT NULL,
	"name" text NOT NULL,
	"home_world" text NOT NULL,
	"data_center" text NOT NULL,
	"avatar_url" text,
	"portrait_url" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xivauth_characters_persistent_key_unique" UNIQUE("persistent_key")
);
--> statement-breakpoint
ALTER TABLE "xivauth_accounts" ADD CONSTRAINT "xivauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "xivauth_characters" ADD CONSTRAINT "xivauth_characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "xivauth_accounts_user_idx" ON "xivauth_accounts" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "xivauth_accounts_user_id_idx" ON "xivauth_accounts" USING btree ("xivauth_user_id");
--> statement-breakpoint
CREATE INDEX "xivauth_characters_user_idx" ON "xivauth_characters" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "xivauth_characters_user_lodestone_idx" ON "xivauth_characters" USING btree ("user_id", "lodestone_id");

CREATE TABLE "auth_tokens" (
	"token" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal" (
	"id" text PRIMARY KEY,
	"uid" text NOT NULL,
	"project_id" text,
	"date_ts" bigint NOT NULL,
	"room" text DEFAULT '' NOT NULL,
	"descr" text DEFAULT '' NOT NULL,
	"area" numeric,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"photos" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "m2entries" (
	"id" text PRIMARY KEY,
	"uid" text NOT NULL,
	"project_id" text,
	"date_ts" bigint NOT NULL,
	"area" numeric DEFAULT '0' NOT NULL,
	"descr" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profit_data" (
	"id" text PRIMARY KEY,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"rates" jsonb DEFAULT '{}' NOT NULL,
	"project_log" jsonb DEFAULT '[]' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY,
	"uid" text NOT NULL,
	"project_id" text,
	"start_ts" bigint NOT NULL,
	"stop_ts" bigint,
	"break_min" integer DEFAULT 0 NOT NULL,
	"type" text DEFAULT 'hour' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"login" text NOT NULL UNIQUE,
	"pass_hash" text NOT NULL,
	"role" text DEFAULT 'worker' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"rate" numeric DEFAULT '0' NOT NULL,
	"rate_m2" numeric DEFAULT '0' NOT NULL,
	"worker_type" text DEFAULT 'hour' NOT NULL,
	"position" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now()
);

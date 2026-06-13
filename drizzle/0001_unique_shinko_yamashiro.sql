CREATE TYPE "public"."day_plan_status" AS ENUM('planning', 'committed', 'closed');--> statement-breakpoint
CREATE TABLE "day_plan_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_plan_id" integer NOT NULL,
	"task_id" integer NOT NULL,
	"outcome" "task_status",
	"carried_over" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_plan_items_day_plan_id_task_id_unique" UNIQUE("day_plan_id","task_id")
);
--> statement-breakpoint
CREATE TABLE "day_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"status" "day_plan_status" DEFAULT 'planning' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "day_plans_date_unique" UNIQUE("date")
);
--> statement-breakpoint
ALTER TABLE "day_plan_items" ADD CONSTRAINT "day_plan_items_day_plan_id_day_plans_id_fk" FOREIGN KEY ("day_plan_id") REFERENCES "public"."day_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_plan_items" ADD CONSTRAINT "day_plan_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;
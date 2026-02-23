CREATE TABLE "payment_records" (
	"id" text PRIMARY KEY NOT NULL,
	"expense_id" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
UPDATE "recurring_expenses" SET "due_day" = 1 WHERE "due_day" IS NULL;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ALTER COLUMN "due_day" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_records_expense_year_month_idx" ON "payment_records" USING btree ("expense_id","year","month");
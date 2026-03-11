ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "last_accessed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "user_agent" text;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "ip_address" varchar(45);
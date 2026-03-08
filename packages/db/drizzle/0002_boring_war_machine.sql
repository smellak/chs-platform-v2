CREATE TABLE "agent_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" uuid NOT NULL,
	"app_id" uuid,
	"can_access" boolean DEFAULT true NOT NULL,
	"blocked_tools" jsonb DEFAULT '[]'::jsonb,
	"allowed_models" jsonb DEFAULT '[]'::jsonb,
	"max_tokens_per_day" integer,
	"max_messages_per_hour" integer,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"metric" varchar(50) NOT NULL,
	"threshold" real NOT NULL,
	"comparison" varchar(10) DEFAULT 'gt' NOT NULL,
	"severity" varchar(20) DEFAULT 'warning' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"rule_id" uuid,
	"severity" varchar(20) NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"model_id" varchar(100) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"cost_per_1k_input" real DEFAULT 0,
	"cost_per_1k_output" real DEFAULT 0,
	"max_tokens" integer DEFAULT 4096,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_model_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid,
	"model_id" uuid NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_messages" ALTER COLUMN "model" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "key_prefix" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "agent_messages" ADD COLUMN "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD COLUMN "output_tokens" integer;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD COLUMN "provider_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD COLUMN "model_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_tool_calls" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "api_providers" ADD COLUMN "provider_type" varchar(20) DEFAULT 'anthropic' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_providers" ADD COLUMN "api_key_encrypted" text;--> statement-breakpoint
ALTER TABLE "api_providers" ADD COLUMN "base_url" varchar(255);--> statement-breakpoint
ALTER TABLE "agent_permissions" ADD CONSTRAINT "agent_permissions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_permissions" ADD CONSTRAINT "agent_permissions_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_permissions" ADD CONSTRAINT "agent_permissions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_alert_rules" ADD CONSTRAINT "ai_alert_rules_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_alert_rules" ADD CONSTRAINT "ai_alert_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_alerts" ADD CONSTRAINT "ai_alerts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_alerts" ADD CONSTRAINT "ai_alerts_rule_id_ai_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."ai_alert_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_alerts" ADD CONSTRAINT "ai_alerts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_api_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."api_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_model_assignments" ADD CONSTRAINT "app_model_assignments_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_model_assignments" ADD CONSTRAINT "app_model_assignments_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_perms_org_target_app_idx" ON "agent_permissions" USING btree ("org_id","target_type","target_id","app_id");--> statement-breakpoint
CREATE INDEX "ai_alerts_org_resolved_idx" ON "ai_alerts" USING btree ("org_id","is_resolved","created_at");--> statement-breakpoint
CREATE INDEX "app_model_assignments_app_priority_idx" ON "app_model_assignments" USING btree ("app_id","priority");--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_provider_id_api_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."api_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE no action ON UPDATE no action;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE "datarooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_blobs" (
	"node_id" uuid PRIMARY KEY NOT NULL,
	"content" "bytea" NOT NULL,
	"content_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataroom_id" uuid NOT NULL,
	"parent_id" uuid,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"size" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nodes_type_check" CHECK ("nodes"."type" IN ('folder', 'file')),
	CONSTRAINT "nodes_size_matches_type_check" CHECK (("nodes"."type" = 'folder' AND "nodes"."size" IS NULL) OR ("nodes"."type" = 'file' AND "nodes"."size" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "file_blobs" ADD CONSTRAINT "file_blobs_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_dataroom_id_datarooms_id_fk" FOREIGN KEY ("dataroom_id") REFERENCES "public"."datarooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_parent_id_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "datarooms_name_lower_unique" ON "datarooms" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "nodes_dataroom_id_idx" ON "nodes" USING btree ("dataroom_id");--> statement-breakpoint
CREATE INDEX "nodes_parent_id_idx" ON "nodes" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nodes_root_name_unique" ON "nodes" USING btree ("dataroom_id",lower("name")) WHERE "nodes"."parent_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "nodes_child_name_unique" ON "nodes" USING btree ("dataroom_id","parent_id",lower("name")) WHERE "nodes"."parent_id" IS NOT NULL;

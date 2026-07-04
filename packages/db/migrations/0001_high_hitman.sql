CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataroom_id" uuid NOT NULL,
	"node_id" uuid,
	"node_name" text,
	"node_type" text,
	"action" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_node_type_check" CHECK ("activity"."node_type" IS NULL OR "activity"."node_type" IN ('folder', 'file')),
	CONSTRAINT "activity_action_check" CHECK ("activity"."action" IN ('dataroom.created', 'folder.created', 'file.uploaded', 'node.renamed', 'node.moved', 'node.deleted', 'member.added', 'member.removed'))
);
--> statement-breakpoint
CREATE TABLE "dataroom_members" (
	"dataroom_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dataroom_members_dataroom_id_user_id_pk" PRIMARY KEY("dataroom_id","user_id"),
	CONSTRAINT "dataroom_members_role_check" CHECK ("dataroom_members"."role" IN ('owner', 'editor', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"dataroom_id" uuid NOT NULL,
	"node_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "users" ("id", "name", "email", "color") VALUES
	('00000000-0000-4000-8000-000000000001', 'Jane Smith', 'jane@acme.com', '#5865f2'),
	('00000000-0000-4000-8000-000000000002', 'Mark Reynolds', 'mark@acme.com', '#35ed7e'),
	('00000000-0000-4000-8000-000000000003', 'Alex Kim', 'alex@acme.com', '#a78bfa'),
	('00000000-0000-4000-8000-000000000004', 'Chris Lee', 'chris@acme.com', '#f6c956'),
	('00000000-0000-4000-8000-000000000005', 'Priya Shah', 'priya@acme.com', '#ec48bd'),
	('00000000-0000-4000-8000-000000000006', 'Noah Garcia', 'noah@acme.com', '#00b0f4')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "datarooms" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "datarooms" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_dataroom_id_datarooms_id_fk" FOREIGN KEY ("dataroom_id") REFERENCES "public"."datarooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataroom_members" ADD CONSTRAINT "dataroom_members_dataroom_id_datarooms_id_fk" FOREIGN KEY ("dataroom_id") REFERENCES "public"."datarooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataroom_members" ADD CONSTRAINT "dataroom_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_dataroom_id_datarooms_id_fk" FOREIGN KEY ("dataroom_id") REFERENCES "public"."datarooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_dataroom_created_at_idx" ON "activity" USING btree ("dataroom_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_node_id_idx" ON "activity" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "dataroom_members_user_id_idx" ON "dataroom_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_room_unique" ON "favorites" USING btree ("user_id","dataroom_id") WHERE "favorites"."node_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_node_unique" ON "favorites" USING btree ("user_id","dataroom_id","node_id") WHERE "favorites"."node_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "favorites_user_id_idx" ON "favorites" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "datarooms" ADD CONSTRAINT "datarooms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datarooms" ADD CONSTRAINT "datarooms_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

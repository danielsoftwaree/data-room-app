ALTER TABLE "activity" DROP CONSTRAINT "activity_action_check";--> statement-breakpoint
DROP INDEX "nodes_root_name_unique";--> statement-breakpoint
DROP INDEX "nodes_child_name_unique";--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nodes_deleted_idx" ON "nodes" USING btree ("dataroom_id") WHERE "nodes"."deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "nodes_root_name_unique" ON "nodes" USING btree ("dataroom_id",lower("name")) WHERE "nodes"."parent_id" IS NULL AND "nodes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "nodes_child_name_unique" ON "nodes" USING btree ("dataroom_id","parent_id",lower("name")) WHERE "nodes"."parent_id" IS NOT NULL AND "nodes"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_action_check" CHECK ("activity"."action" IN ('dataroom.created', 'folder.created', 'file.uploaded', 'node.renamed', 'node.moved', 'node.deleted', 'node.restored', 'member.added', 'member.updated', 'member.removed'));
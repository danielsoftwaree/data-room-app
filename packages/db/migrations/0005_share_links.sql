CREATE TABLE "node_shares" (
	"node_id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_action_check";--> statement-breakpoint
ALTER TABLE "node_shares" ADD CONSTRAINT "node_shares_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_shares" ADD CONSTRAINT "node_shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "node_shares_slug_unique" ON "node_shares" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_action_check" CHECK ("activity"."action" IN ('dataroom.created', 'folder.created', 'file.uploaded', 'node.renamed', 'node.moved', 'node.deleted', 'node.restored', 'member.added', 'member.updated', 'member.removed', 'share.created', 'share.removed'));
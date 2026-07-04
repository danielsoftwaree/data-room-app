DROP INDEX "datarooms_name_lower_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "datarooms_owner_name_lower_unique" ON "datarooms" USING btree ("created_by",lower("name"));
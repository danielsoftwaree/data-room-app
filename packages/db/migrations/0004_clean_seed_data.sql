-- Wipe seeded demo data so production starts empty: real users are provisioned
-- on first sign-in (Clerk), and data rooms are created by users themselves.
-- Deleting datarooms first cascades to nodes, members, favorites and activity,
-- which clears every foreign key into users (activity.actor_id is RESTRICT), so
-- the subsequent users wipe is safe.
DELETE FROM "datarooms";--> statement-breakpoint
DELETE FROM "users";
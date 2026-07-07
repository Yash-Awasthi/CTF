CREATE TABLE `login_rate_limit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`scope` text NOT NULL,
	`subject` text NOT NULL,
	`window_start` integer DEFAULT (unixepoch()) NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `login_rate_limit_scope_unq` ON `login_rate_limit` (`event_id`,`scope`,`subject`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_one_active_per_participant` ON `sessions` (`participant_id`) WHERE revoked_at IS NULL;
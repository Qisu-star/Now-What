CREATE TABLE `placements` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`day` text NOT NULL,
	`start_minute` integer NOT NULL,
	`end_minute` integer NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`adjusted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `placements_day_idx` ON `placements` (`day`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`priority` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`color` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`completed_at` text,
	`archived_at` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host_hash` text NOT NULL,
	`phase` text DEFAULT 'lobby' NOT NULL,
	`round_index` integer DEFAULT -1 NOT NULL,
	`flips` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`room_code` text NOT NULL,
	`round_index` integer NOT NULL,
	`participant_hash` text NOT NULL,
	`choice` text NOT NULL,
	`confidence` integer NOT NULL,
	`submitted_at` integer NOT NULL,
	PRIMARY KEY(`room_code`, `round_index`, `participant_hash`),
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);

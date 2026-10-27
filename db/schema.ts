import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  hostHash: text('host_hash').notNull(),
  phase: text('phase').notNull().default('lobby'),
  roundIndex: integer('round_index').notNull().default(-1),
  flips: text('flips').notNull(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export const votes = sqliteTable('votes', {
  roomCode: text('room_code').notNull().references(() => rooms.code, { onDelete: 'cascade' }),
  roundIndex: integer('round_index').notNull(),
  participantHash: text('participant_hash').notNull(),
  choice: text('choice').notNull(),
  confidence: integer('confidence').notNull(),
  submittedAt: integer('submitted_at').notNull(),
}, (table) => [primaryKey({ columns: [table.roomCode, table.roundIndex, table.participantHash] })]);

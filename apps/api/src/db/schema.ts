import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  priority: text('priority', { enum: ['primary', 'secondary', 'normal', 'pending'] }).notNull(),
  startAt: text('start_at').notNull(),
  endAt: text('end_at').notNull(),
  color: integer('color').notNull().default(0),
  status: text('status', { enum: ['active', 'archived'] }).notNull().default('active'),
  completedAt: text('completed_at'),
  archivedAt: text('archived_at'),
  note: text('note').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const placements = sqliteTable(
  'placements',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    startMinute: integer('start_minute').notNull(),
    endMinute: integer('end_minute').notNull(),
    source: text('source', { enum: ['auto', 'manual'] }).notNull().default('manual'),
    adjusted: integer('adjusted', { mode: 'boolean' }).notNull().default(false)
  },
  (table) => [index('placements_day_idx').on(table.day)]
)

export type TaskRow = typeof tasks.$inferSelect
export type PlacementRow = typeof placements.$inferSelect

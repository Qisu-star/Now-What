import { z } from 'zod'

export const prioritySchema = z.enum(['primary', 'secondary', 'normal', 'pending'])

export const taskInputSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: prioritySchema,
  startAt: z.string(),
  endAt: z.string()
})

export const taskSchema = taskInputSchema.extend({
  id: z.string(),
  color: z.number().int(),
  status: z.enum(['active', 'archived']),
  completedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  note: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const placementSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  day: z.string(),
  startMinute: z.number().int(),
  endMinute: z.number().int(),
  source: z.enum(['auto', 'manual']),
  adjusted: z.boolean()
})

export const taskListResponseSchema = z.object({
  tasks: z.array(taskSchema)
})

export const taskDetailResponseSchema = z.object({
  task: taskSchema,
  placements: z.array(placementSchema)
})

export const taskWriteResponseSchema = z.object({
  task: taskSchema,
  placement: placementSchema.nullable()
})

export const validationIssueSchema = z.object({
  field: z.string(),
  message: z.string()
})

export const validationErrorSchema = z.object({
  error: z.object({
    code: z.literal('VALIDATION_ERROR'),
    message: z.string(),
    details: z.array(validationIssueSchema)
  })
})

export const notFoundErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string()
  })
})

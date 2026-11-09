import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  archiveInputSchema,
  archiveResponseSchema,
  conflictErrorSchema,
  notFoundErrorSchema,
  taskDetailResponseSchema,
  taskInputSchema,
  taskListResponseSchema,
  taskResponseSchema,
  taskUpdateSchema,
  taskWriteResponseSchema,
  validationErrorSchema,
  type Clock
} from '@nowwhat/shared'
import type { AppDb } from '../db/client.ts'
import {
  archiveTask,
  createTask,
  deleteTask,
  getTaskDetail,
  listTasks,
  unarchiveTask,
  updateTask
} from '../services/tasks.ts'
import { removeTaskFiles } from '../services/attachments.ts'

export interface TaskRoutesDeps {
  clock: Clock
  db: AppDb
  uploadDir: string
}

const paramsSchema = z.object({ id: z.string() })
const querySchema = z.object({ status: z.enum(['active', 'archived']).optional() })

export async function taskRoutes(app: FastifyInstance, deps: TaskRoutesDeps): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get(
    '/api/v1/tasks',
    {
      schema: {
        tags: ['tasks'],
        summary: '事务列表',
        querystring: querySchema,
        response: { 200: taskListResponseSchema }
      }
    },
    async (request) => {
      const status = request.query.status ?? 'active'
      return { tasks: listTasks(deps.db, status) }
    }
  )

  server.post(
    '/api/v1/tasks',
    {
      schema: {
        tags: ['tasks'],
        summary: '创建事务',
        body: taskInputSchema,
        response: {
          201: taskWriteResponseSchema,
          422: validationErrorSchema
        }
      }
    },
    async (request, reply) => {
      const result = createTask(deps.db, deps.clock, request.body)
      if (!result.ok) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: '输入不合法', details: result.issues }
        })
      }
      return reply.code(201).send(result.value)
    }
  )

  server.get(
    '/api/v1/tasks/:id',
    {
      schema: {
        tags: ['tasks'],
        summary: '事务详情',
        params: paramsSchema,
        response: {
          200: taskDetailResponseSchema,
          404: notFoundErrorSchema
        }
      }
    },
    async (request, reply) => {
      const detail = getTaskDetail(deps.db, request.params.id)
      if (!detail) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '事务不存在' } })
      }
      return detail
    }
  )

  server.patch(
    '/api/v1/tasks/:id',
    {
      schema: {
        tags: ['tasks'],
        summary: '修改事务',
        params: paramsSchema,
        body: taskUpdateSchema,
        response: {
          200: taskWriteResponseSchema,
          404: notFoundErrorSchema,
          422: validationErrorSchema
        }
      }
    },
    async (request, reply) => {
      const result = updateTask(deps.db, deps.clock, request.params.id, request.body)
      if (!result) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '事务不存在' } })
      }
      if (!result.ok) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_ERROR', message: '输入不合法', details: result.issues }
        })
      }
      return reply.send(result.value)
    }
  )

  server.post(
    '/api/v1/tasks/:id/archive',
    {
      schema: {
        tags: ['tasks'],
        summary: '归档事务',
        params: paramsSchema,
        body: archiveInputSchema,
        response: {
          200: archiveResponseSchema,
          404: notFoundErrorSchema,
          409: conflictErrorSchema,
          422: validationErrorSchema
        }
      }
    },
    async (request, reply) => {
      const result = archiveTask(deps.db, deps.clock, request.params.id, request.body)
      if (!result.ok) {
        if (result.code === 'VALIDATION') {
          return reply.code(422).send({
            error: { code: 'VALIDATION_ERROR', message: '输入不合法', details: result.issues }
          })
        }
        if (result.code === 'NOT_FOUND') {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '事务不存在' } })
        }
        return reply.code(409).send({ error: { code: 'CONFLICT', message: '事务已归档' } })
      }
      return reply.send({ task: result.task, released: result.released })
    }
  )

  server.post(
    '/api/v1/tasks/:id/unarchive',
    {
      schema: {
        tags: ['tasks'],
        summary: '取消归档',
        params: paramsSchema,
        response: {
          200: taskResponseSchema,
          404: notFoundErrorSchema,
          409: conflictErrorSchema
        }
      }
    },
    async (request, reply) => {
      const result = unarchiveTask(deps.db, deps.clock, request.params.id)
      if (!result.ok) {
        if (result.code === 'NOT_FOUND') {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '事务不存在' } })
        }
        return reply.code(409).send({ error: { code: 'CONFLICT', message: '事务尚未归档' } })
      }
      return reply.send({ task: result.task })
    }
  )

  server.delete(
    '/api/v1/tasks/:id',
    {
      schema: {
        tags: ['tasks'],
        summary: '删除事务',
        params: paramsSchema,
        response: { 204: z.null(), 404: notFoundErrorSchema }
      }
    },
    async (request, reply) => {
      removeTaskFiles(deps.db, deps.uploadDir, request.params.id)
      const removed = deleteTask(deps.db, request.params.id)
      if (!removed) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '事务不存在' } })
      }
      return reply.code(204).send(null)
    }
  )
}

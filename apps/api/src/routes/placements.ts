import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  conflictErrorSchema,
  notFoundErrorSchema,
  placementInputSchema,
  placementListResponseSchema,
  placementResponseSchema,
  placementUpdateSchema,
  validationErrorSchema
} from '@nowwhat/shared'
import type { AppDb } from '../db/client.ts'
import {
  createPlacement,
  deletePlacement,
  listPlacements,
  updatePlacementById
} from '../services/placements.ts'

export interface PlacementRoutesDeps {
  db: AppDb
}

const paramsSchema = z.object({ id: z.string() })
const rangeSchema = z.object({ from: z.string(), to: z.string() })

export async function placementRoutes(
  app: FastifyInstance,
  deps: PlacementRoutesDeps
): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get(
    '/api/v1/placements',
    {
      schema: {
        tags: ['placements'],
        summary: '按日期范围获取计划时段',
        querystring: rangeSchema,
        response: { 200: placementListResponseSchema, 422: validationErrorSchema }
      }
    },
    async (request, reply) => {
      const { from, to } = request.query
      if (to < from) {
        return reply.code(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: '日期范围不合法',
            details: [{ field: 'to', message: '结束日期不能早于开始日期' }]
          }
        })
      }
      return { placements: listPlacements(deps.db, from, to) }
    }
  )

  server.post(
    '/api/v1/placements',
    {
      schema: {
        tags: ['placements'],
        summary: '新增计划时段',
        body: placementInputSchema,
        response: {
          201: placementResponseSchema,
          404: notFoundErrorSchema,
          409: conflictErrorSchema,
          422: validationErrorSchema
        }
      }
    },
    async (request, reply) => {
      const result = createPlacement(deps.db, request.body)
      if (!result.ok) {
        if (result.code === 'VALIDATION') {
          return reply.code(422).send({
            error: { code: 'VALIDATION_ERROR', message: '输入不合法', details: result.issues }
          })
        }
        if (result.code === 'NOT_FOUND') {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '事务不存在' } })
        }
        return reply.code(409).send({ error: { code: 'CONFLICT', message: '该时段已被占用' } })
      }
      return reply.code(201).send({ placement: result.placement })
    }
  )

  server.patch(
    '/api/v1/placements/:id',
    {
      schema: {
        tags: ['placements'],
        summary: '调整计划时段',
        params: paramsSchema,
        body: placementUpdateSchema,
        response: {
          200: placementResponseSchema,
          404: notFoundErrorSchema,
          409: conflictErrorSchema,
          422: validationErrorSchema
        }
      }
    },
    async (request, reply) => {
      const result = updatePlacementById(deps.db, request.params.id, request.body)
      if (!result) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '计划时段不存在' } })
      }
      if (!result.ok) {
        if (result.code === 'VALIDATION') {
          return reply.code(422).send({
            error: { code: 'VALIDATION_ERROR', message: '输入不合法', details: result.issues }
          })
        }
        return reply.code(409).send({ error: { code: 'CONFLICT', message: '该时段已被占用' } })
      }
      return reply.send({ placement: result.placement })
    }
  )

  server.delete(
    '/api/v1/placements/:id',
    {
      schema: {
        tags: ['placements'],
        summary: '删除计划时段',
        params: paramsSchema,
        response: { 204: z.null(), 404: notFoundErrorSchema }
      }
    },
    async (request, reply) => {
      const removed = deletePlacement(deps.db, request.params.id)
      if (!removed) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '计划时段不存在' } })
      }
      return reply.code(204).send(null)
    }
  )
}

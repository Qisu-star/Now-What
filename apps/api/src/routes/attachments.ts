import { createReadStream } from 'node:fs'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  attachmentListResponseSchema,
  attachmentResponseSchema,
  notFoundErrorSchema,
  validationErrorSchema,
  type Clock
} from '@nowwhat/shared'
import type { AppDb } from '../db/client.ts'
import {
  deleteAttachment,
  filePath,
  getAttachment,
  listAttachments,
  saveAttachment
} from '../services/attachments.ts'

export interface AttachmentRoutesDeps {
  db: AppDb
  clock: Clock
  uploadDir: string
}

const paramsSchema = z.object({ id: z.string() })
const querySchema = z.object({ taskId: z.string() })

const simpleErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() })
})

export async function attachmentRoutes(
  app: FastifyInstance,
  deps: AttachmentRoutesDeps
): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get(
    '/api/v1/attachments',
    {
      schema: {
        tags: ['attachments'],
        summary: '事务附件列表',
        querystring: querySchema,
        response: { 200: attachmentListResponseSchema }
      }
    },
    async (request) => {
      return { attachments: listAttachments(deps.db, request.query.taskId) }
    }
  )

  server.post(
    '/api/v1/attachments',
    {
      schema: {
        tags: ['attachments'],
        summary: '上传附件',
        response: {
          201: attachmentResponseSchema,
          404: notFoundErrorSchema,
          413: simpleErrorSchema,
          415: simpleErrorSchema,
          422: validationErrorSchema
        }
      }
    },
    async (request, reply) => {
      let taskId = ''
      let filename = ''
      let mimeType = ''
      let data: Buffer | null = null
      let truncated = false

      for await (const part of request.parts()) {
        if (part.type === 'file') {
          const chunks: Buffer[] = []
          for await (const chunk of part.file) {
            chunks.push(chunk as Buffer)
          }
          filename = part.filename
          mimeType = part.mimetype
          data = Buffer.concat(chunks)
          truncated = part.file.truncated
        } else if (part.fieldname === 'taskId') {
          taskId = String(part.value)
        }
      }

      if (!taskId) {
        return reply.code(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: '缺少 taskId',
            details: [{ field: 'taskId', message: '必须指定所属事务' }]
          }
        })
      }

      if (!data || !filename) {
        return reply.code(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: '缺少文件',
            details: [{ field: 'file', message: '请选择要上传的文件' }]
          }
        })
      }

      if (truncated) {
        return reply.code(413).send({
          error: { code: 'PAYLOAD_TOO_LARGE', message: '单个附件不能超过 20 MB' }
        })
      }

      const result = saveAttachment(deps.db, deps.clock, deps.uploadDir, {
        taskId,
        filename,
        mimeType,
        data
      })

      if (!result.ok) {
        if (result.code === 'NOT_FOUND') {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '事务不存在' } })
        }
        if (result.code === 'UNSUPPORTED') {
          return reply.code(415).send({
            error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: '不支持的文件格式' }
          })
        }
        return reply.code(413).send({
          error: { code: 'PAYLOAD_TOO_LARGE', message: '单个附件不能超过 20 MB' }
        })
      }

      return reply.code(201).send({ attachment: result.attachment })
    }
  )

  server.get(
    '/api/v1/attachments/:id/content',
    {
      schema: {
        tags: ['attachments'],
        summary: '下载或预览附件',
        params: paramsSchema
      }
    },
    async (request, reply) => {
      const row = getAttachment(deps.db, request.params.id)
      if (!row) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '附件不存在' } })
      }

      const target = filePath(deps.uploadDir, row.taskId, row.id, row.filename)
      const encoded = encodeURIComponent(row.filename)

      return reply
        .type(row.mimeType)
        .header('content-disposition', `inline; filename*=UTF-8''${encoded}`)
        .send(createReadStream(target))
    }
  )

  server.delete(
    '/api/v1/attachments/:id',
    {
      schema: {
        tags: ['attachments'],
        summary: '删除附件',
        params: paramsSchema,
        response: { 204: z.null(), 404: notFoundErrorSchema }
      }
    },
    async (request, reply) => {
      const removed = deleteAttachment(deps.db, deps.uploadDir, request.params.id)
      if (!removed) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '附件不存在' } })
      }
      return reply.code(204).send(null)
    }
  )
}

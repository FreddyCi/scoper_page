import { DOCUMENT_CAPABILITIES } from '@/ecp/extensions/document'
import type { BitgpuJsonSchema } from '@/lib/schemas'

export const findClauseInputSchema: BitgpuJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['query'],
  properties: {
    query: { type: 'string', minLength: 1, maxLength: 500 },
    docIds: {
      type: 'array',
      maxItems: 32,
      items: { type: 'string', minLength: 1 },
    },
    limit: { type: 'integer', minimum: 1, maximum: 12 },
  },
}

export const documentSearchInputSchema: BitgpuJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['query'],
  properties: {
    query: { type: 'string', minLength: 1, maxLength: 500 },
    docIds: {
      type: 'array',
      maxItems: 32,
      items: { type: 'string', minLength: 1 },
    },
    limit: { type: 'integer', minimum: 1, maximum: 50 },
  },
}

/** Input schemas for ECP-governed agent tool capabilities */
export const ecpToolInputSchemas: Record<string, BitgpuJsonSchema> = {
  [DOCUMENT_CAPABILITIES.find_clause]: findClauseInputSchema,
  [DOCUMENT_CAPABILITIES.search]: documentSearchInputSchema,
}

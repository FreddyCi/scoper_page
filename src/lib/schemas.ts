/**
 * JSON Schema objects for bitgpu `format: { json: { schema } }`.
 * Enforceable subset only: type, properties, required, additionalProperties,
 * items, minItems/maxItems, enum, minLength/maxLength, integer min/max, discriminated oneOf.
 * @see https://github.com/stfurkan/bitgpu#guaranteed-valid-json-format-json
 */

/** Schema node accepted by bitgpu constrained decoding */
export type BitgpuJsonSchema = {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null'
  properties?: Record<string, BitgpuJsonSchema>
  required?: string[]
  additionalProperties?: boolean
  items?: BitgpuJsonSchema
  enum?: string[]
  minItems?: number
  maxItems?: number
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  oneOf?: BitgpuJsonSchema[]
  description?: string
  title?: string
}

const bboxSchema: BitgpuJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['x', 'y', 'width', 'height'],
  properties: {
    x: { type: 'number', description: 'Left edge in page coordinates' },
    y: { type: 'number', description: 'Top edge in page coordinates' },
    width: { type: 'number' },
    height: { type: 'number' },
  },
}

export const citationRefSchema: BitgpuJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['doc_id', 'block_id', 'excerpt'],
  properties: {
    doc_id: { type: 'string', minLength: 1 },
    block_id: { type: 'string', minLength: 1 },
    page_num: { type: 'integer', minimum: 1 },
    bbox: bboxSchema,
    excerpt: { type: 'string', minLength: 1, maxLength: 500 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
}

export const criterionResultSchema: BitgpuJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'label', 'status'],
  properties: {
    id: { type: 'string', minLength: 1 },
    label: { type: 'string', minLength: 1, maxLength: 200 },
    status: {
      type: 'string',
      enum: ['pass', 'warn', 'fail'],
      description: 'pass = meets requirement, warn = borderline, fail = does not meet',
    },
    detail: { type: 'string', maxLength: 500 },
    citation: citationRefSchema,
  },
}

export const rfpSubjectSchema: BitgpuJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120 },
    role: { type: 'string', maxLength: 120 },
    location: { type: 'string', maxLength: 120 },
  },
}

/** Single RFP qualification profile (one bidder / response) */
export const rfpResultsProfileSchema: BitgpuJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['profile_id', 'source_doc_id', 'verdict', 'subject', 'criteria', 'summary'],
  properties: {
    profile_id: { type: 'string', minLength: 1 },
    source_doc_id: { type: 'string', minLength: 1 },
    verdict: {
      type: 'string',
      enum: ['likely', 'might', 'unlikely'],
    },
    subject: rfpSubjectSchema,
    criteria: {
      type: 'array',
      minItems: 1,
      maxItems: 32,
      items: criterionResultSchema,
    },
    summary: { type: 'string', minLength: 1, maxLength: 800 },
  },
}

/** `build_rfp_profiles` — array of qualification cards */
export const rfpProfilesResponseSchema: BitgpuJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['profiles'],
  properties: {
    profiles: {
      type: 'array',
      minItems: 1,
      maxItems: 12,
      items: rfpResultsProfileSchema,
    },
  },
}

export const rfpRequirementSchema: BitgpuJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'label'],
  properties: {
    id: { type: 'string', minLength: 1 },
    label: { type: 'string', minLength: 1, maxLength: 200 },
    category: { type: 'string', maxLength: 80 },
    citation: citationRefSchema,
  },
}

/** Extract RFP requirement checklist before bidder evaluation */
export const rfpRequirementsResponseSchema: BitgpuJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['requirements', 'summary'],
  properties: {
    requirements: {
      type: 'array',
      minItems: 1,
      maxItems: 48,
      items: rfpRequirementSchema,
    },
    summary: { type: 'string', minLength: 1, maxLength: 600 },
  },
}

export const scopeCreepFlagSchema: BitgpuJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'flag_type', 'severity', 'summary', 'evidence'],
  properties: {
    id: { type: 'string', minLength: 1 },
    flag_type: {
      type: 'string',
      minLength: 1,
      maxLength: 80,
      description: 'e.g. new_deliverable, scope_expansion, timeline_shift, budget_gap',
    },
    severity: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
    summary: { type: 'string', minLength: 1, maxLength: 400 },
    evidence: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: citationRefSchema,
    },
  },
}

export const scopeCreepProfileSchema: BitgpuJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'profile_id',
    'baseline_doc_id',
    'candidate_doc_id',
    'verdict',
    'flags',
    'summary',
  ],
  properties: {
    profile_id: { type: 'string', minLength: 1 },
    baseline_doc_id: { type: 'string', minLength: 1 },
    candidate_doc_id: { type: 'string', minLength: 1 },
    verdict: {
      type: 'string',
      enum: ['aligned', 'possible_creep', 'creep'],
    },
    flags: {
      type: 'array',
      maxItems: 24,
      items: scopeCreepFlagSchema,
    },
    summary: { type: 'string', minLength: 1, maxLength: 800 },
  },
}

/** `compare_scope` / `flag_creep` — scope drift analysis */
export const scopeCreepProfilesResponseSchema: BitgpuJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['profiles'],
  properties: {
    profiles: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: scopeCreepProfileSchema,
    },
  },
}

export const findClauseMatchSchema: BitgpuJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['citation', 'relevance'],
  properties: {
    citation: citationRefSchema,
    relevance: { type: 'string', minLength: 1, maxLength: 300 },
  },
}

/** `find_clause` tool response */
export const findClauseResponseSchema: BitgpuJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['matches', 'summary'],
  properties: {
    matches: {
      type: 'array',
      maxItems: 12,
      items: findClauseMatchSchema,
    },
    summary: { type: 'string', minLength: 1, maxLength: 600 },
  },
}

/** Named schemas for bitgpu client / agent tools */
export const bitgpuSchemas = {
  citationRef: citationRefSchema,
  rfpProfiles: rfpProfilesResponseSchema,
  rfpRequirements: rfpRequirementsResponseSchema,
  scopeCreepProfiles: scopeCreepProfilesResponseSchema,
  findClause: findClauseResponseSchema,
} as const satisfies Record<string, BitgpuJsonSchema>

export type BitgpuSchemaName = keyof typeof bitgpuSchemas

/** Wrap schema for bitgpu chat.send format option */
export function bitgpuJsonFormat(schema: BitgpuJsonSchema) {
  return { format: { json: { schema } } } as const
}

/** @deprecated Use rfpProfilesResponseSchema */
export const rfpProfileSchema = rfpProfilesResponseSchema

import type { BitgpuJsonSchema } from '@/lib/schemas'

export type EcpToolValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function typeLabel(schema: BitgpuJsonSchema): string {
  if (schema.type) return schema.type
  if (schema.oneOf) return schema.oneOf.map(typeLabel).join(' | ')
  return 'value'
}

function validateNode(value: unknown, schema: BitgpuJsonSchema, path: string): string[] {
  if (schema.oneOf?.length) {
    const branchErrors = schema.oneOf.map((branch, index) =>
      validateNode(value, branch, `${path}(oneOf[${index}])`),
    )

    if (branchErrors.some((errors) => errors.length === 0)) {
      return []
    }

    return [`${path}: must match one of ${schema.oneOf.length} allowed shapes`]
  }

  if (schema.enum?.length) {
    if (typeof value !== 'string' || !schema.enum.includes(value)) {
      return [`${path}: must be one of ${schema.enum.join(', ')}`]
    }
    return []
  }

  switch (schema.type) {
    case 'string': {
      if (typeof value !== 'string') {
        return [`${path}: expected string, got ${typeof value}`]
      }

      const errors: string[] = []
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`${path}: must be at least ${schema.minLength} characters`)
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`${path}: must be at most ${schema.maxLength} characters`)
      }
      return errors
    }

    case 'integer': {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return [`${path}: expected integer`]
      }

      const errors: string[] = []
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path}: must be >= ${schema.minimum}`)
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path}: must be <= ${schema.maximum}`)
      }
      return errors
    }

    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return [`${path}: expected number`]
      }

      const errors: string[] = []
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path}: must be >= ${schema.minimum}`)
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path}: must be <= ${schema.maximum}`)
      }
      return errors
    }

    case 'boolean': {
      return typeof value === 'boolean' ? [] : [`${path}: expected boolean`]
    }

    case 'array': {
      if (!Array.isArray(value)) {
        return [`${path}: expected array`]
      }

      const errors: string[] = []
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        errors.push(`${path}: must contain at least ${schema.minItems} items`)
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        errors.push(`${path}: must contain at most ${schema.maxItems} items`)
      }

      if (schema.items) {
        for (let index = 0; index < value.length; index += 1) {
          errors.push(...validateNode(value[index], schema.items, `${path}[${index}]`))
        }
      }

      return errors
    }

    case 'object': {
      if (!isRecord(value)) {
        return [`${path}: expected object`]
      }

      const errors: string[] = []
      const properties = schema.properties ?? {}

      for (const key of schema.required ?? []) {
        if (!(key in value)) {
          errors.push(`${path}.${key}: required`)
        }
      }

      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          if (!(key in properties)) {
            errors.push(`${path}.${key}: additional property not allowed`)
          }
        }
      }

      for (const [key, propertySchema] of Object.entries(properties)) {
        if (key in value) {
          errors.push(...validateNode(value[key], propertySchema, `${path}.${key}`))
        }
      }

      return errors
    }

    default:
      return [`${path}: unsupported schema type ${typeLabel(schema)}`]
  }
}

/** Validate agent tool input against a bitgpu-compatible JSON schema subset (BDA-062) */
export function validateEcpToolInput(
  input: unknown,
  schema: BitgpuJsonSchema,
): EcpToolValidationResult {
  const errors = validateNode(input, schema, 'input')

  if (errors.length === 0) {
    return { ok: true }
  }

  return { ok: false, errors }
}

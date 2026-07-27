export const rfpProfileSchema = {
  type: 'object',
  properties: {
    profiles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          verdict: { type: 'string', enum: ['likely', 'might', 'unlikely'] },
          subject: { type: 'object' },
          criteria: { type: 'array' },
          summary: { type: 'string' },
        },
        required: ['verdict', 'subject', 'criteria', 'summary'],
      },
    },
  },
  required: ['profiles'],
} as const

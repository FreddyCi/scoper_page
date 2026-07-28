import { capabilityId } from '@/ecp/types'
import { getScoperClient } from '@/services/scoper-client'

export const BITGPU_EXTENSION_ID = '@demo/bitgpu'

export const bitgpuExtension = {
  id: BITGPU_EXTENSION_ID,
  label: 'Scoper bitgpu runtime',
  capabilities: {
    ping: async () => {
      const client = getScoperClient()
      return client.ping()
    },
    probe: async () => {
      const client = getScoperClient()
      return client.probeEnvironment()
    },
    status: async () => getScoperClient().getState(),
  },
} as const

export const BITGPU_CAPABILITIES = {
  ping: capabilityId(BITGPU_EXTENSION_ID, 'ping'),
  probe: capabilityId(BITGPU_EXTENSION_ID, 'probe'),
  status: capabilityId(BITGPU_EXTENSION_ID, 'status'),
} as const

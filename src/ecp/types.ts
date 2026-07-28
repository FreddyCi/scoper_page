export type EcpCapabilityHandler = (input: unknown) => Promise<unknown>

/** Registered @demo extension with named capability handlers (BDA-061) */
export type DemoExtensionDefinition = {
  id: string
  label?: string
  capabilities: Record<string, EcpCapabilityHandler>
}

export function capabilityId(extensionId: string, name: string): string {
  return `${extensionId}.${name}`
}

export function parseCapabilityId(fullId: string): { extensionId: string; name: string } {
  const separator = fullId.indexOf('.')
  if (separator <= 0 || separator === fullId.length - 1) {
    throw new Error(`Invalid capability id: ${fullId}`)
  }

  return {
    extensionId: fullId.slice(0, separator),
    name: fullId.slice(separator + 1),
  }
}

export class EcpCapabilityNotFoundError extends Error {
  readonly code = 'ECP_CAPABILITY_NOT_FOUND' as const

  constructor(capabilityId: string) {
    super(`Capability not found: ${capabilityId}`)
    this.name = 'EcpCapabilityNotFoundError'
  }
}

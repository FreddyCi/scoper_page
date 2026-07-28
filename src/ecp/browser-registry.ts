import {
  evaluateRegistryRegistration,
  type RegistryControlConfig,
} from '@/ecp/registry-control'
import type { DemoExtensionDefinition } from '@/ecp/types'
import { EcpCapabilityNotFoundError, parseCapabilityId } from '@/ecp/types'

export class RegistryFrozenError extends Error {
  readonly code = 'REGISTRY_FROZEN' as const

  constructor(reason?: string) {
    super(reason ? `Registry is frozen: ${reason}` : 'Registry is frozen')
    this.name = 'RegistryFrozenError'
  }
}

export class RegistryRegistrationDeniedError extends Error {
  readonly code = 'REGISTRY_REGISTRATION_DENIED' as const

  constructor(
    readonly extensionId: string,
    reason?: string,
  ) {
    super(reason ?? `Extension registration denied: ${extensionId}`)
    this.name = 'RegistryRegistrationDeniedError'
  }
}

type ScoperEcpRegistryOptions = {
  policy: RegistryControlConfig
}

/** In-browser extension registry with freeze, policy, and capability invoke (BDA-060/061) */
export class ScoperEcpRegistry {
  private frozen = false
  private freezeReason: string | undefined
  private readonly extensions = new Map<string, DemoExtensionDefinition>()

  constructor(private readonly options: ScoperEcpRegistryOptions) {}

  registerExtension(definition: DemoExtensionDefinition): void {
    if (this.frozen) {
      throw new RegistryFrozenError(this.freezeReason)
    }

    const decision = evaluateRegistryRegistration(definition.id, this.options.policy)
    if (!decision.allowed) {
      throw new RegistryRegistrationDeniedError(definition.id, decision.reason)
    }

    this.extensions.set(definition.id, definition)
  }

  freeze(reason?: string): void {
    this.frozen = true
    this.freezeReason = reason
  }

  isFrozen(): boolean {
    return this.frozen
  }

  listExtensions(): DemoExtensionDefinition[] {
    return [...this.extensions.values()]
  }

  listCapabilities(): string[] {
    const ids: string[] = []

    for (const extension of this.extensions.values()) {
      for (const name of Object.keys(extension.capabilities)) {
        ids.push(`${extension.id}.${name}`)
      }
    }

    return ids.sort()
  }

  async invokeCapability(capabilityId: string, input: unknown = {}): Promise<unknown> {
    const { extensionId, name } = parseCapabilityId(capabilityId)
    const extension = this.extensions.get(extensionId)

    if (!extension) {
      throw new EcpCapabilityNotFoundError(capabilityId)
    }

    const handler = extension.capabilities[name]
    if (!handler) {
      throw new EcpCapabilityNotFoundError(capabilityId)
    }

    return handler(input)
  }
}

export type BrowserEcpGlobal = {
  registerExtension: (definition: DemoExtensionDefinition) => Promise<void>
  freezeRegistry: (reason?: string) => void
  isRegistryFrozen: () => boolean
  invokeCapability: (capabilityId: string, input?: unknown) => Promise<unknown>
  listCapabilities: () => string[]
}

export function createBrowserEcpGlobal(registry: ScoperEcpRegistry): BrowserEcpGlobal {
  return {
    async registerExtension(definition) {
      registry.registerExtension(definition)
    },
    freezeRegistry(reason) {
      registry.freeze(reason)
    },
    isRegistryFrozen() {
      return registry.isFrozen()
    },
    async invokeCapability(capabilityId, input) {
      return registry.invokeCapability(capabilityId, input)
    },
    listCapabilities() {
      return registry.listCapabilities()
    },
  }
}

export function exposeBrowserEcpGlobal(
  registry: ScoperEcpRegistry,
  globalName: string,
): BrowserEcpGlobal {
  const api = createBrowserEcpGlobal(registry)
  ;(globalThis as Record<string, unknown>)[globalName] = api
  return api
}

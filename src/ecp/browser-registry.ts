import {
  evaluateRegistryRegistration,
  type RegistryControlConfig,
} from '@/ecp/registry-control'

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

export type EcpExtensionDefinition = {
  id: string
}

type ScoperEcpRegistryOptions = {
  policy: RegistryControlConfig
}

/** In-browser extension registry with freeze + namespace policy (BDA-060) */
export class ScoperEcpRegistry {
  private frozen = false
  private freezeReason: string | undefined
  private readonly extensions = new Map<string, EcpExtensionDefinition>()

  constructor(private readonly options: ScoperEcpRegistryOptions) {}

  registerExtension(definition: EcpExtensionDefinition): void {
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

  listExtensions(): EcpExtensionDefinition[] {
    return [...this.extensions.values()]
  }
}

export type BrowserEcpGlobal = {
  registerExtension: (definition: EcpExtensionDefinition) => Promise<void>
  freezeRegistry: (reason?: string) => void
  isRegistryFrozen: () => boolean
}

export function createBrowserEcpGlobal(
  registry: ScoperEcpRegistry,
): BrowserEcpGlobal {
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

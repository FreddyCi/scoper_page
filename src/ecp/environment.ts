import {
  createBrowserEcpGlobal,
  exposeBrowserEcpGlobal,
  RegistryFrozenError,
  RegistryRegistrationDeniedError,
  ScoperEcpRegistry,
  type BrowserEcpGlobal,
  type EcpExtensionDefinition,
} from '@/ecp/browser-registry'

export const SCOPER_ECP_ENV_ID = '@demo/scoper-browser'
export const SCOPER_ECP_GLOBAL_NAME = 'ECP'

const REGISTRY_CONTROL_POLICY = {
  allowedExtensionNamespaces: ['@demo/*'],
  deniedExtensionNamespaces: [] as string[],
  allowDynamicExtensionRegistration: true,
} as const

export type BrowserOperationalEcp = BrowserEcpGlobal & {
  getEnvironmentId: () => string
  getRegistry: () => ScoperEcpRegistry
}

let initPromise: Promise<BrowserOperationalEcp> | null = null
let operationalEcp: BrowserOperationalEcp | null = null
let registry: ScoperEcpRegistry | null = null

function createOperationalEcp(nextRegistry: ScoperEcpRegistry): BrowserOperationalEcp {
  const globalApi = exposeBrowserEcpGlobal(nextRegistry, SCOPER_ECP_GLOBAL_NAME)

  return {
    ...globalApi,
    getEnvironmentId: () => SCOPER_ECP_ENV_ID,
    getRegistry: () => nextRegistry,
  }
}

/** Initialize ECP-compatible browser registry and expose `window.ECP` (BDA-060) */
export async function initScoperEcpEnvironment(): Promise<BrowserOperationalEcp> {
  if (operationalEcp) return operationalEcp
  if (initPromise) return initPromise

  initPromise = Promise.resolve().then(() => {
    registry = new ScoperEcpRegistry({ policy: REGISTRY_CONTROL_POLICY })
    operationalEcp = createOperationalEcp(registry)
    return operationalEcp
  })

  return initPromise
}

export function getScoperEcp(): BrowserOperationalEcp | null {
  return operationalEcp
}

export function getScoperEcpRegistry(): ScoperEcpRegistry | null {
  return registry
}

/** Freeze extension registry before the first agent run */
export function freezeScoperEcpRegistry(reason = 'before-agent-run'): void {
  registry?.freeze(reason)
}

/** Boot ECP and freeze registry — call before chat agent turns (BDA-060) */
export async function ensureScoperEcpReadyBeforeAgentRun(): Promise<BrowserOperationalEcp> {
  const ecp = await initScoperEcpEnvironment()
  freezeScoperEcpRegistry()
  return ecp
}

export function isScoperEcpRegistryFrozen(): boolean {
  return registry?.isFrozen() ?? false
}

function harnessStubExtension(suffix: string): EcpExtensionDefinition {
  return { id: `@demo/${suffix}` }
}

/** Dev harness — ECP init, namespace policy, registry freeze (BDA-060) */
export async function runEcpEnvironmentHarness(): Promise<void> {
  operationalEcp = null
  initPromise = null
  registry = null

  const ecp = await initScoperEcpEnvironment()

  if (ecp.isRegistryFrozen()) {
    throw new Error('runEcpEnvironmentHarness failed: registry should not start frozen')
  }

  await ecp.registerExtension(harnessStubExtension('harness-allowed'))

  try {
    await ecp.registerExtension({ id: '@unsafe/denied' })
    throw new Error('runEcpEnvironmentHarness failed: expected denied @unsafe extension')
  } catch (error) {
    if (!(error instanceof RegistryRegistrationDeniedError)) {
      throw error
    }
  }

  ecp.freezeRegistry('harness-freeze')

  if (!ecp.isRegistryFrozen()) {
    throw new Error('runEcpEnvironmentHarness failed: expected frozen registry')
  }

  try {
    await ecp.registerExtension(harnessStubExtension('harness-late'))
    throw new Error('runEcpEnvironmentHarness failed: expected late registration to fail')
  } catch (error) {
    if (!(error instanceof RegistryFrozenError)) {
      throw error
    }
  }

  operationalEcp = null
  initPromise = null
  registry = null
}

export {
  RegistryFrozenError,
  RegistryRegistrationDeniedError,
  createBrowserEcpGlobal,
  type BrowserEcpGlobal,
  type EcpExtensionDefinition,
}

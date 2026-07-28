import {
  createBrowserEcpGlobal,
  exposeBrowserEcpGlobal,
  RegistryFrozenError,
  RegistryRegistrationDeniedError,
  ScoperEcpRegistry,
  type BrowserEcpGlobal,
} from '@/ecp/browser-registry'
import {
  BITGPU_CAPABILITIES,
  BITGPU_EXTENSION_ID,
} from '@/ecp/extensions/bitgpu'
import {
  DOCUMENT_CAPABILITIES,
  DOCUMENT_EXTENSION_ID,
} from '@/ecp/extensions/document'
import {
  DUCKDB_CAPABILITIES,
  DUCKDB_EXTENSION_ID,
} from '@/ecp/extensions/duckdb'
import {
  LITEPARSE_CAPABILITIES,
  LITEPARSE_EXTENSION_ID,
} from '@/ecp/extensions/liteparse'
import { registerDemoExtensions } from '@/ecp/register-extensions'
import type { DemoExtensionDefinition } from '@/ecp/types'
import type { FindClauseResult } from '@/lib/types'
import { findClause } from '@/services/find-clause'
import { ingestFile } from '@/services/ingest-router'

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

/** Initialize ECP-compatible browser registry, register @demo extensions, expose `window.ECP` (BDA-060/061) */
export async function initScoperEcpEnvironment(): Promise<BrowserOperationalEcp> {
  if (operationalEcp) return operationalEcp
  if (initPromise) return initPromise

  initPromise = Promise.resolve().then(() => {
    registry = new ScoperEcpRegistry({ policy: REGISTRY_CONTROL_POLICY })
    registerDemoExtensions(registry)
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

/** Invoke a registered capability by id (e.g. `@demo/document.find_clause`) */
export async function invokeEcpCapability(
  capabilityId: string,
  input: unknown = {},
): Promise<unknown> {
  const ecp = await initScoperEcpEnvironment()
  return ecp.invokeCapability(capabilityId, input)
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

function harnessStubExtension(suffix: string): DemoExtensionDefinition {
  return {
    id: `@demo/${suffix}`,
    capabilities: {
      ping: async () => 'ok',
    },
  }
}

const REQUIRED_DEMO_CAPABILITIES = [
  BITGPU_CAPABILITIES.ping,
  BITGPU_CAPABILITIES.probe,
  BITGPU_CAPABILITIES.status,
  LITEPARSE_CAPABILITIES.ping,
  LITEPARSE_CAPABILITIES.parse,
  DUCKDB_CAPABILITIES.ping,
  DUCKDB_CAPABILITIES.query,
  DUCKDB_CAPABILITIES.insertDocument,
  DUCKDB_CAPABILITIES.insertBlock,
  DOCUMENT_CAPABILITIES.parse,
  DOCUMENT_CAPABILITIES.search,
  DOCUMENT_CAPABILITIES.find_clause,
  DOCUMENT_CAPABILITIES.build_rfp_profiles,
  DOCUMENT_CAPABILITIES.compare_scope,
  DOCUMENT_CAPABILITIES.flag_creep,
] as const

const REQUIRED_DEMO_EXTENSIONS = [
  BITGPU_EXTENSION_ID,
  LITEPARSE_EXTENSION_ID,
  DUCKDB_EXTENSION_ID,
  DOCUMENT_EXTENSION_ID,
] as const

function assertFindClauseParity(
  direct: FindClauseResult,
  viaEcp: FindClauseResult,
): void {
  if (direct.summary !== viaEcp.summary) {
    throw new Error('runDemoExtensionsHarness failed: find_clause summary mismatch')
  }

  if (direct.matches.length !== viaEcp.matches.length) {
    throw new Error('runDemoExtensionsHarness failed: find_clause match count mismatch')
  }

  for (let index = 0; index < direct.matches.length; index += 1) {
    const left = direct.matches[index]
    const right = viaEcp.matches[index]

    if (left.citation.block_id !== right.citation.block_id) {
      throw new Error('runDemoExtensionsHarness failed: find_clause citation block_id mismatch')
    }
  }
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

  for (const extensionId of REQUIRED_DEMO_EXTENSIONS) {
    const registered = ecp
      .getRegistry()
      .listExtensions()
      .some((extension) => extension.id === extensionId)

    if (!registered) {
      throw new Error(`runEcpEnvironmentHarness failed: missing extension ${extensionId}`)
    }
  }

  await ecp.registerExtension(harnessStubExtension('harness-allowed'))

  try {
    await ecp.registerExtension({ id: '@unsafe/denied', capabilities: {} })
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

/** Dev harness — @demo extensions registered; ECP invoke matches direct service calls (BDA-061) */
export async function runDemoExtensionsHarness(): Promise<void> {
  operationalEcp = null
  initPromise = null
  registry = null

  const ecp = await initScoperEcpEnvironment()
  const registered = new Set(ecp.listCapabilities())

  for (const capabilityId of REQUIRED_DEMO_CAPABILITIES) {
    if (!registered.has(capabilityId)) {
      throw new Error(`runDemoExtensionsHarness failed: missing capability ${capabilityId}`)
    }
  }

  const bitgpuPing = await ecp.invokeCapability(BITGPU_CAPABILITIES.ping)
  if (typeof bitgpuPing !== 'string' || !bitgpuPing.trim()) {
    throw new Error('runDemoExtensionsHarness failed: @demo/bitgpu.ping returned empty response')
  }

  const liteparsePing = await ecp.invokeCapability(LITEPARSE_CAPABILITIES.ping)
  if (typeof liteparsePing !== 'string' || !liteparsePing.trim()) {
    throw new Error('runDemoExtensionsHarness failed: @demo/liteparse.ping returned empty response')
  }

  const duckdbPing = await ecp.invokeCapability(DUCKDB_CAPABILITIES.ping)
  if (typeof duckdbPing !== 'string' || !duckdbPing.trim()) {
    throw new Error('runDemoExtensionsHarness failed: @demo/duckdb.ping returned empty response')
  }

  const response = await fetch('/sample/minimal.pdf')
  if (!response.ok) {
    throw new Error(`runDemoExtensionsHarness failed: sample PDF (${response.status})`)
  }

  const blob = await response.blob()
  const ingested = await ingestFile(new File([blob], 'minimal.pdf', { type: 'application/pdf' }), {
    ocrEnabled: false,
  })

  const query = 'find indemnification'
  const direct = await findClause(query, { docIds: [ingested.doc_id], limit: 3 })
  const viaEcp = (await ecp.invokeCapability(DOCUMENT_CAPABILITIES.find_clause, {
    query,
    docIds: [ingested.doc_id],
    limit: 3,
  })) as FindClauseResult

  assertFindClauseParity(direct, viaEcp)

  const baselineMarkdown = [
    '# Baseline SOW',
    '',
    'Monthly PDF reporting package is included in scope.',
    'All deliverables shall be completed within one hundred twenty (120) calendar days.',
  ].join('\n')

  const changeMarkdown = [
    '# Change Addendum',
    '',
    'Contractor shall provide additional analytics dashboards beyond the baseline reporting package.',
    'All deliverables shall be completed within ninety (90) calendar days.',
  ].join('\n')

  const baseline = await ingestFile(
    new File([baselineMarkdown], 'ecp-baseline.md', { type: 'text/markdown' }),
  )
  const change = await ingestFile(
    new File([changeMarkdown], 'ecp-change.md', { type: 'text/markdown' }),
  )

  const compareScope = (await ecp.invokeCapability(DOCUMENT_CAPABILITIES.compare_scope, {
    baselineDocId: baseline.doc_id,
    candidateDocId: change.doc_id,
  })) as { summary?: string; profiles?: Array<{ flags: unknown[] }> }

  if (!compareScope.summary?.trim()) {
    throw new Error('runDemoExtensionsHarness failed: compare_scope summary missing')
  }

  const profile = compareScope.profiles?.[0]
  if (!profile || profile.flags.length === 0) {
    throw new Error('runDemoExtensionsHarness failed: compare_scope expected scope flags')
  }
}

export {
  RegistryFrozenError,
  RegistryRegistrationDeniedError,
  createBrowserEcpGlobal,
  type BrowserEcpGlobal,
  type DemoExtensionDefinition,
}


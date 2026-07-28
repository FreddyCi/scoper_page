import {
  ensureScoperEcpReadyBeforeAgentRun,
  getScoperEcpRegistry,
  invokeEcpCapability,
  isScoperEcpRegistryFrozen,
} from '@/ecp/environment'
import { DOCUMENT_CAPABILITIES } from '@/ecp/extensions/document'
import { evaluateRegistryRegistration } from '@/ecp/registry-control'
import { ecpToolInputSchemas } from '@/ecp/tool-schemas'
import { validateEcpToolInput } from '@/ecp/tool-validation'
import { EcpCapabilityNotFoundError } from '@/ecp/types'
import type { FindClauseResult } from '@/lib/types'
import { ingestFile } from '@/services/ingest-router'

export type EcpAgentRunDenyCode =
  | 'REGISTRY_NOT_FROZEN'
  | 'CAPABILITY_NOT_FOUND'
  | 'NAMESPACE_DENIED'
  | 'PARAMS_INVALID'

export class EcpAgentRunDeniedError extends Error {
  readonly code: EcpAgentRunDenyCode

  constructor(code: EcpAgentRunDenyCode, message: string) {
    super(message)
    this.name = 'EcpAgentRunDeniedError'
    this.code = code
  }
}

export type EcpAgentAuditEntry = {
  at: string
  capabilityId: string
  decision: 'allow' | 'deny'
  code?: EcpAgentRunDenyCode
  detail?: string
}

const AGENT_REGISTRY_POLICY = {
  allowedExtensionNamespaces: ['@demo/*'],
  deniedExtensionNamespaces: [] as string[],
  allowDynamicExtensionRegistration: true,
} as const

const auditLog: EcpAgentAuditEntry[] = []

export function getEcpAgentAuditLog(): readonly EcpAgentAuditEntry[] {
  return auditLog
}

export function clearEcpAgentAuditLog(): void {
  auditLog.length = 0
}

function recordAudit(entry: Omit<EcpAgentAuditEntry, 'at'>): void {
  auditLog.push({ ...entry, at: new Date().toISOString() })
}

export type RunEcpAgentToolOptions = {
  capabilityId: string
  input: unknown
  /** When true, skip ensureScoperEcpReadyBeforeAgentRun (caller already prepared ECP) */
  ecpReady?: boolean
}

function deny(
  capabilityId: string,
  code: EcpAgentRunDenyCode,
  message: string,
): never {
  recordAudit({ capabilityId, decision: 'deny', code, detail: message })
  throw new EcpAgentRunDeniedError(code, message)
}

/** ECP-governed agent tool run — validate params, audit allow/deny, invoke capability (BDA-062) */
export async function runEcpAgentTool(options: RunEcpAgentToolOptions): Promise<unknown> {
  const { capabilityId, input, ecpReady = false } = options

  if (!ecpReady) {
    await ensureScoperEcpReadyBeforeAgentRun()
  }

  if (!isScoperEcpRegistryFrozen()) {
    deny(
      capabilityId,
      'REGISTRY_NOT_FROZEN',
      'Tool call blocked: extension registry must be frozen before agent tools run.',
    )
  }

  const extensionId = capabilityId.includes('.')
    ? capabilityId.slice(0, capabilityId.indexOf('.'))
    : capabilityId

  const namespaceDecision = evaluateRegistryRegistration(extensionId, AGENT_REGISTRY_POLICY)
  if (!namespaceDecision.allowed) {
    deny(capabilityId, 'NAMESPACE_DENIED', `Tool call blocked: ${namespaceDecision.reason}`)
  }

  const schema = ecpToolInputSchemas[capabilityId]
  if (schema) {
    const validation = validateEcpToolInput(input, schema)
    if (!validation.ok) {
      deny(
        capabilityId,
        'PARAMS_INVALID',
        `Tool call rejected: ${validation.errors.join('; ')}`,
      )
    }
  }

  const registered = new Set(getScoperEcpRegistry()?.listCapabilities() ?? [])
  if (!registered.has(capabilityId)) {
    deny(capabilityId, 'CAPABILITY_NOT_FOUND', `Tool call blocked: unknown capability ${capabilityId}`)
  }

  try {
    const result = await invokeEcpCapability(capabilityId, input)
    recordAudit({ capabilityId, decision: 'allow' })
    return result
  } catch (error) {
    if (error instanceof EcpCapabilityNotFoundError) {
      deny(capabilityId, 'CAPABILITY_NOT_FOUND', `Tool call blocked: ${error.message}`)
    }
    throw error
  }
}

/** Dev harness — invalid params denied with audit; valid find_clause executes via ECP (BDA-062) */
export async function runEcpAgentRunHarness(): Promise<void> {
  clearEcpAgentAuditLog()
  await ensureScoperEcpReadyBeforeAgentRun()

  try {
    await runEcpAgentTool({
      capabilityId: DOCUMENT_CAPABILITIES.find_clause,
      input: { query: '' },
      ecpReady: true,
    })
    throw new Error('runEcpAgentRunHarness failed: expected PARAMS_INVALID rejection')
  } catch (error) {
    if (!(error instanceof EcpAgentRunDeniedError) || error.code !== 'PARAMS_INVALID') {
      throw error
    }
  }

  const invalidAudit = getEcpAgentAuditLog().find(
    (entry) =>
      entry.capabilityId === DOCUMENT_CAPABILITIES.find_clause &&
      entry.decision === 'deny' &&
      entry.code === 'PARAMS_INVALID',
  )

  if (!invalidAudit) {
    throw new Error('runEcpAgentRunHarness failed: expected PARAMS_INVALID audit entry')
  }

  const response = await fetch('/sample/minimal.pdf')
  if (!response.ok) {
    throw new Error(`runEcpAgentRunHarness failed: sample PDF (${response.status})`)
  }

  const blob = await response.blob()
  const ingested = await ingestFile(new File([blob], 'minimal.pdf', { type: 'application/pdf' }), {
    ocrEnabled: false,
  })

  const result = (await runEcpAgentTool({
    capabilityId: DOCUMENT_CAPABILITIES.find_clause,
    input: {
      query: 'find indemnification',
      docIds: [ingested.doc_id],
      limit: 3,
    },
    ecpReady: true,
  })) as FindClauseResult

  if (!result.summary.trim()) {
    throw new Error('runEcpAgentRunHarness failed: expected find_clause summary')
  }

  const allowAudit = getEcpAgentAuditLog().find(
    (entry) =>
      entry.capabilityId === DOCUMENT_CAPABILITIES.find_clause && entry.decision === 'allow',
  )

  if (!allowAudit) {
    throw new Error('runEcpAgentRunHarness failed: expected allow audit entry')
  }
}

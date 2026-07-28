export {
  SCOPER_ECP_ENV_ID,
  SCOPER_ECP_GLOBAL_NAME,
  ensureScoperEcpReadyBeforeAgentRun,
  freezeScoperEcpRegistry,
  getScoperEcp,
  getScoperEcpRegistry,
  initScoperEcpEnvironment,
  invokeEcpCapability,
  isScoperEcpRegistryFrozen,
  runDemoExtensionsHarness,
  runEcpEnvironmentHarness,
  RegistryFrozenError,
  RegistryRegistrationDeniedError,
  type BrowserEcpGlobal,
  type BrowserOperationalEcp,
  type DemoExtensionDefinition,
} from '@/ecp/environment'

export {
  clearEcpAgentAuditLog,
  EcpAgentRunDeniedError,
  getEcpAgentAuditLog,
  runEcpAgentRunHarness,
  runEcpAgentTool,
  type EcpAgentAuditEntry,
  type EcpAgentRunDenyCode,
  type RunEcpAgentToolOptions,
} from '@/ecp/agent-run'

export {
  BITGPU_CAPABILITIES,
  BITGPU_EXTENSION_ID,
} from '@/ecp/extensions/bitgpu'
export {
  DOCUMENT_CAPABILITIES,
  DOCUMENT_EXTENSION_ID,
} from '@/ecp/extensions/document'
export {
  DUCKDB_CAPABILITIES,
  DUCKDB_EXTENSION_ID,
} from '@/ecp/extensions/duckdb'
export {
  LITEPARSE_CAPABILITIES,
  LITEPARSE_EXTENSION_ID,
} from '@/ecp/extensions/liteparse'
export { registerDemoExtensions, DEMO_EXTENSIONS } from '@/ecp/register-extensions'
export {
  capabilityId,
  parseCapabilityId,
  EcpCapabilityNotFoundError,
  type EcpCapabilityHandler,
} from '@/ecp/types'

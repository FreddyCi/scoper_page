import { bitgpuExtension } from '@/ecp/extensions/bitgpu'
import { documentExtension } from '@/ecp/extensions/document'
import { duckdbExtension } from '@/ecp/extensions/duckdb'
import { liteparseExtension } from '@/ecp/extensions/liteparse'
import type { ScoperEcpRegistry } from '@/ecp/browser-registry'

const DEMO_EXTENSIONS = [bitgpuExtension, liteparseExtension, duckdbExtension, documentExtension]

/** Register all @demo/* extensions at ECP boot (BDA-061) */
export function registerDemoExtensions(registry: ScoperEcpRegistry): void {
  for (const extension of DEMO_EXTENSIONS) {
    registry.registerExtension(extension)
  }
}

export { DEMO_EXTENSIONS }

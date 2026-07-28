/** Namespace pattern match — mirrors ECP `matchesAnyNamespace` (`@demo/*`) */
export function matchesNamespace(id: string, pattern: string): boolean {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1)
    return id.startsWith(prefix)
  }

  return id === pattern
}

export function matchesAnyNamespace(id: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesNamespace(id, pattern))
}

export type RegistryControlConfig = {
  allowedExtensionNamespaces?: readonly string[]
  deniedExtensionNamespaces?: readonly string[]
  allowDynamicExtensionRegistration?: boolean
}

export function evaluateRegistryRegistration(
  extensionId: string,
  config: RegistryControlConfig,
): { allowed: true } | { allowed: false; reason: string } {
  if (config.allowDynamicExtensionRegistration === false) {
    return { allowed: false, reason: 'Dynamic extension registration is disabled' }
  }

  const denied = config.deniedExtensionNamespaces ?? []
  if (denied.length > 0 && matchesAnyNamespace(extensionId, denied)) {
    return { allowed: false, reason: `Extension namespace is denied: ${extensionId}` }
  }

  const allowed = config.allowedExtensionNamespaces ?? []
  if (allowed.length > 0 && !matchesAnyNamespace(extensionId, allowed)) {
    return { allowed: false, reason: `Extension namespace is not allowed: ${extensionId}` }
  }

  return { allowed: true }
}

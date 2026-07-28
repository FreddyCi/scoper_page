export async function probeWebGpu(): Promise<import('@/lib/scoper-protocol').WebGpuProbeResult> {
  if (typeof navigator === 'undefined') {
    return { available: false, error: 'WebGPU is not available in this browser.' }
  }

  const gpu = (navigator as Navigator & {
    gpu?: { requestAdapter: (options?: { powerPreference?: string }) => Promise<unknown> }
  }).gpu
  if (!gpu) {
    return { available: false, error: 'WebGPU is not available in this browser.' }
  }

  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' })
    if (!adapter) {
      return { available: false, error: 'No WebGPU adapter was found on this device.' }
    }
    return { available: true }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

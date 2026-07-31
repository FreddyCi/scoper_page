/** Shared WebGPU copy for banner + voice UI (BDA-191). */
export const WEBGPU_UNAVAILABLE_BANNER_FALLBACK =
  'WebGPU is unavailable. On-device chat is disabled; document parsing still works.'

export const WEBGPU_VOICE_INPUT_TOOLTIP = 'WebGPU unavailable — voice input disabled'

export function resolveWebGpuUnavailableMessage(webGpuError: string | null | undefined): string {
  return webGpuError?.trim() || WEBGPU_UNAVAILABLE_BANNER_FALLBACK
}

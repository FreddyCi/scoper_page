/** Mic hidden when WebGPU probe completed and unavailable. */
export function shouldShowChatVoiceMic(webGpuAvailable: boolean | null): boolean {
  return webGpuAvailable !== false
}

/** Stop active voice capture before chat send / GPU handoff to Scoper. */
export function shouldStopChatVoiceForHandoff(
  voiceSessionActive: boolean,
  sendingChat: boolean,
): boolean {
  return voiceSessionActive && sendingChat
}

/** Dev harness — voice gating helpers (BDA-191). */
export function runChatVoiceGatingHarness(): void {
  if (shouldShowChatVoiceMic(false)) {
    throw new Error('runChatVoiceGatingHarness: mic should hide when WebGPU false')
  }
  if (!shouldShowChatVoiceMic(true) || !shouldShowChatVoiceMic(null)) {
    throw new Error('runChatVoiceGatingHarness: mic should show when WebGPU true or probing')
  }
  if (!shouldStopChatVoiceForHandoff(true, true)) {
    throw new Error('runChatVoiceGatingHarness: expect stop on send while active')
  }
  if (shouldStopChatVoiceForHandoff(false, true)) {
    throw new Error('runChatVoiceGatingHarness: no stop when session idle')
  }
}

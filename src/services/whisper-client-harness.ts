import { createWhisperClient } from '@/services/whisper-client'

/** Dev harness — client load + silence transcribe; skips when WebGPU unavailable (BDA-184, BDA-193). */
export async function runWhisperClientHarness(): Promise<void> {
  const client = createWhisperClient()

  try {
    const env = await client.probeEnvironment()
    if (!env.webGpuAvailable) {
      if (import.meta.env.DEV) {
        console.warn('[whisper-client-harness] skip — WebGPU unavailable')
      }
      return
    }

    const pong = await client.ping()
    if (pong !== 'pong') {
      throw new Error(`runWhisperClientHarness: expected pong, got ${String(pong)}`)
    }

    await client.ensureLoaded()

    const partials: string[] = []
    client.setListeners({
      onPartial: (text) => partials.push(text),
    })

    const silence = new Float32Array(16_000)
    const result = await client.transcribeChunk(silence, { copyAudio: true })

    if (typeof result.text !== 'string') {
      throw new Error('runWhisperClientHarness: transcribe result missing text')
    }

    if (import.meta.env.DEV) {
      console.debug('[whisper-client-harness] ok', {
        textLength: result.text.length,
        partialEvents: partials.length,
        status: client.getState().status,
      })
    }
  } finally {
    await client.dispose()
  }
}

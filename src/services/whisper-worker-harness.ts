import { probeWebGpu } from '@/lib/scoper-webgpu'
import type { WhisperWorkerOutbound, WhisperWorkerRequest } from '@/lib/whisper-protocol'
import WhisperWorker from '@/workers/whisper.worker?worker'

function workerCall<T>(
  worker: Worker,
  request: WhisperWorkerRequest,
  transfer: Transferable[] = [],
): Promise<T> {
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<WhisperWorkerOutbound>) => {
      const message = event.data
      if (!('id' in message) || message.id !== request.id) return
      worker.removeEventListener('message', onMessage)
      if (message.ok) {
        resolve(message.result as T)
        return
      }
      reject(new Error(message.error))
    }
    worker.addEventListener('message', onMessage)
    worker.postMessage(request, transfer)
  })
}

/**
 * Dev harness — load Whisper worker + transcribe short silence (BDA-183).
 * Skips when WebGPU is unavailable (WASM fallback may still work but is slow in CI).
 */
export async function runWhisperWorkerHarness(): Promise<void> {
  const webGpu = await probeWebGpu()
  if (!webGpu.available) {
    if (import.meta.env.DEV) {
      console.warn('[whisper-worker-harness] skip — WebGPU unavailable')
    }
    return
  }

  const worker = new WhisperWorker()
  try {
    const pong = await workerCall<string>(
      worker,
      { id: 'wh-ping', type: 'ping' },
    )
    if (pong !== 'pong') {
      throw new Error(`runWhisperWorkerHarness: expected pong, got ${String(pong)}`)
    }

    await workerCall(worker, { id: 'wh-load', type: 'load' })

    const silence = new Float32Array(16_000)
    const result = await workerCall<{ text: string }>(
      worker,
      {
        id: 'wh-transcribe',
        type: 'transcribe',
        audio: silence,
        sampleRateHz: 16_000,
      },
      [silence.buffer],
    )

    if (typeof result.text !== 'string') {
      throw new Error('runWhisperWorkerHarness: transcribe result missing text')
    }

    await workerCall(worker, { id: 'wh-dispose', type: 'dispose' })

    if (import.meta.env.DEV) {
      console.debug('[whisper-worker-harness] ok', { textLength: result.text.length })
    }
  } finally {
    worker.terminate()
  }
}

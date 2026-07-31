import { runWhisperClientHarness } from '@/services/whisper-client-harness'

/** @deprecated Prefer {@link runWhisperClientHarness} (BDA-184). */
export async function runWhisperWorkerHarness(): Promise<void> {
  await runWhisperClientHarness()
}

import { runChatVoiceButtonLabelsHarness } from '@/components/chat/ChatVoiceButton'
import { runChatComposerVoiceDraftHarness } from '@/lib/chat-composer-voice-draft'
import { runChatVoiceGatingHarness } from '@/lib/chat-voice-gating'
import { runSpeechChunkVadHarness } from '@/lib/speech-chunk-vad'
import { runSpeechTranscriptCleanupHarness } from '@/lib/speech-transcript-cleanup'
import { runWhisperProtocolHarness } from '@/lib/whisper-protocol'
import { runWhisperClientCleanupHarness } from '@/services/whisper-client'
import { runWhisperClientHarness } from '@/services/whisper-client-harness'
import { runChatVoiceCaptureHarness } from '@/services/chat-voice-capture'
import {
  runChatVoiceSessionHarness,
  runChatVoiceSessionMergeHarness,
} from '@/services/chat-voice-session'

/** Sync chat-voice harnesses — always run in dev (BDA-193). */
export function runChatVoiceUnitHarnesses(): void {
  runWhisperProtocolHarness()
  runSpeechTranscriptCleanupHarness()
  runSpeechChunkVadHarness()
  runWhisperClientCleanupHarness()
  runChatVoiceButtonLabelsHarness()
  runChatComposerVoiceDraftHarness()
  runChatVoiceGatingHarness()
  runChatVoiceCaptureHarness()
  runChatVoiceSessionMergeHarness()
}

/** Async chat-voice harnesses — WebGPU smoke skips gracefully when unavailable (BDA-193). */
export async function runChatVoiceAsyncHarnesses(): Promise<void> {
  await runChatVoiceSessionHarness()
  await runWhisperClientHarness()
}

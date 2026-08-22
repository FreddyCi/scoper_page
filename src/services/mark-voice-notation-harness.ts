import { runCommentDraftDictationHarness } from '@/hooks/use-comment-draft-dictation'
import { runMarkDictationMergeHarness } from '@/hooks/use-mark-dictation'
import { runSpeechNotesHarness } from '@/lib/speech-notes'

/** Sync mark voice notation harnesses — speech utils + merge math (BDA-257). */
export function runMarkVoiceNotationUnitHarnesses(): void {
  runSpeechNotesHarness()
  runMarkDictationMergeHarness()
  runCommentDraftDictationHarness()
}

#!/usr/bin/env node
/**
 * Static pre-checks for proposal mode sign-off (BDA-151, BDA-180) — no browser.
 */
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(relPath) {
  return readFileSync(path.join(root, relPath), 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[qa:proposal] FAIL ${message}`)
    process.exit(1)
  }
}

console.log('[qa:proposal] BDA-151 static checks')

const workspaceContent = read('src/components/workspace/WorkspaceContent.tsx')
assert(
  workspaceContent.includes('ProposalGenerationPanel'),
  'WorkspaceContent must render ProposalGenerationPanel',
)
assert(
  workspaceContent.includes("mode === 'rfp'"),
  'WorkspaceContent must branch RFP vs proposal profiles',
)
assert(
  !workspaceContent.includes('CreepProfileGrid'),
  'WorkspaceContent must not mount CreepProfileGrid',
)

const scopeCreepHits = execSync('rg -l scope_creep src || true', {
  cwd: root,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean)

const allowedLegacy = new Set([
  'src/services/share-pack-import.ts',
  'src/lib/share-table.ts',
])
const unexpected = scopeCreepHits.filter((file) => !allowedLegacy.has(file))
assert(
  unexpected.length === 0,
  `scope_creep string only allowed in share-pack-import; found: ${unexpected.join(', ')}`,
)

const samplePdf = path.join(root, 'public/sample/rfp-it-services.pdf')
try {
  readFileSync(samplePdf)
} catch {
  assert(false, 'public/sample/rfp-it-services.pdf missing — run pnpm copy:samples')
}

console.log('[qa:proposal] PASS BDA-151 routing, scope_creep containment, sample RFP')

console.log('[qa:proposal] BDA-180 sectional UCW + chat UX static checks')

const chatComposer = read('src/components/chat/ChatComposer.tsx')
assert(
  chatComposer.includes('ContextUsageComposerCluster'),
  'ChatComposer must mount ContextUsageComposerCluster (BDA-171)',
)

const chatTranscript = read('src/components/chat/ChatTranscript.tsx')
assert(
  chatTranscript.includes('AgentActivityMarkers'),
  'ChatTranscript must mount AgentActivityMarkers (BDA-173)',
)

const sessionStore = read('src/store/session-store.ts')
const generateFnStart = sessionStore.indexOf('runGenerateProposalVolumes: async')
assert(generateFnStart >= 0, 'session-store must define runGenerateProposalVolumes')
const generateFnBody = sessionStore.slice(generateFnStart, generateFnStart + 2200)
assert(
  generateFnBody.includes('proposalGenerating: true'),
  'runGenerateProposalVolumes must set proposalGenerating',
)
assert(
  !/chatGenerating:\s*true/.test(generateFnBody),
  'runGenerateProposalVolumes must not set chatGenerating during proposal batch',
)

const buildVolumes = read('src/services/build-proposal-volumes.ts')
assert(
  buildVolumes.includes('notifyProposalSectionRoll'),
  'build-proposal-volumes must roll context between sections (BDA-164)',
)

const generationHarness = read('src/services/proposal-generation-harness.ts')
assert(
  generationHarness.includes('assertSectionalAgentActivityLog'),
  'proposal-generation-harness must assert sectional activity (BDA-179)',
)
assert(
  generationHarness.includes('assertContextUsageWithinContextSize'),
  'proposal-generation-harness must assert context usage budget (BDA-179)',
)

const proposalPanel = read('src/components/workspace/ProposalGenerationPanel.tsx')
assert(
  proposalPanel.includes('canExportProposalProfile'),
  'ProposalGenerationPanel must gate export on canExportProposalProfile (BDA-176)',
)

assert(
  existsSync(path.join(root, 'docs/PROPOSAL_CONTEXT_AND_SECTIONS.md')),
  'docs/PROPOSAL_CONTEXT_AND_SECTIONS.md must exist (BDA-177)',
)

console.log(
  '[qa:proposal] PASS BDA-180 static wiring (context ring, activity markers, sectional loop, export gate)',
)

console.log('[qa:proposal] BDA-195 chat voice static checks')

assert(
  chatComposer.includes('ChatVoiceButton'),
  'ChatComposer must mount ChatVoiceButton (BDA-190)',
)
assert(
  chatComposer.includes('mergeComposerVoiceDraft'),
  'ChatComposer must merge voice partials into draft (BDA-190)',
)
assert(
  chatComposer.includes('voicePhase === \'listening\'') &&
    chatComposer.includes('isChatVoiceSessionActive()'),
  'ChatComposer handleSend must block while voice session active (BDA-191)',
)
assert(
  chatComposer.includes('!voiceActive'),
  'ChatComposer canSend must disable send during voice load/listen (BDA-195)',
)

const chatVoiceButton = read('src/components/chat/ChatVoiceButton.tsx')
assert(
  chatVoiceButton.includes('shouldShowChatVoiceMic'),
  'ChatVoiceButton must hide mic when WebGPU unavailable (BDA-191)',
)

const appTsx = read('src/App.tsx')
assert(
  appTsx.includes('runChatVoiceUnitHarnesses'),
  'App dev chain must run runChatVoiceUnitHarnesses (BDA-193)',
)
assert(
  appTsx.includes('runChatVoiceAsyncHarnesses'),
  'App dev chain must run runChatVoiceAsyncHarnesses (BDA-193)',
)

assert(
  existsSync(path.join(root, 'src/services/chat-voice-dev-harnesses.ts')),
  'chat-voice-dev-harnesses.ts must exist (BDA-193)',
)
assert(
  existsSync(path.join(root, 'src/services/whisper-client-harness.ts')),
  'whisper-client-harness.ts must exist (BDA-193)',
)

const architecture = read('docs/ARCHITECTURE.md')
assert(
  architecture.includes('whisper.worker'),
  'ARCHITECTURE.md must document whisper worker (BDA-194)',
)

console.log('[qa:proposal] PASS BDA-195 chat voice wiring (composer, gates, harnesses, docs)')

console.log(
  '[qa:proposal] Manual UI: TASK_BREAKDOWN_CHAT_VOICE.md § BDA-195 manual checklist; baseline BDA-151 in TASK_BREAKDOWN_PROPOSAL_MODE.md',
)
console.log(
  '[qa:proposal] Manual UI: TASK_BREAKDOWN_PROPOSAL_SECTIONAL_UCW.md § BDA-180; baseline BDA-151 in TASK_BREAKDOWN_PROPOSAL_MODE.md',
)

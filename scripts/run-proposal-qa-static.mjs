#!/usr/bin/env node
/**
 * Static pre-checks for proposal mode sign-off (BDA-151, BDA-180) — no browser.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function listSourceFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      listSourceFiles(fullPath, files)
      continue
    }
    if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

function sourceFilesContaining(needle) {
  const srcRoot = path.join(root, 'src')
  return listSourceFiles(srcRoot)
    .filter((filePath) => readFileSync(filePath, 'utf8').includes(needle))
    .map((filePath) => path.relative(root, filePath))
}

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

const scopeCreepHits = sourceFilesContaining('scope_creep')

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

const singleVolumeFnStart = sessionStore.indexOf('runGenerateProposalVolume: async')
assert(singleVolumeFnStart >= 0, 'session-store must define runGenerateProposalVolume (BDA-199)')
const singleVolumeFnBody = sessionStore.slice(singleVolumeFnStart, singleVolumeFnStart + 2400)
assert(
  singleVolumeFnBody.includes('isolatedVolumeRun: true'),
  'runGenerateProposalVolume must use isolated volume handoff (BDA-199)',
)
assert(
  singleVolumeFnBody.includes('buildProposalVolume('),
  'runGenerateProposalVolume must call buildProposalVolume (BDA-199)',
)

const profileBuildStart = sessionStore.indexOf('runProposalRequirementsProfile: async')
assert(profileBuildStart >= 0, 'session-store must define runProposalRequirementsProfile')
const profileBuildBody = sessionStore.slice(profileBuildStart, profileBuildStart + 1200)
assert(
  profileBuildBody.includes('baselineProfile: state.evaluationBaselineProfile'),
  'runProposalRequirementsProfile must pass evaluation baseline into profile build (BDA-209)',
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
assert(
  generationHarness.includes('runGenerateProposalVolume'),
  'proposal-generation-harness must exercise single-volume store generate (BDA-202)',
)
assert(
  generationHarness.includes('should stay pending after single-volume generate'),
  'proposal-generation-harness must assert sibling volumes stay pending (BDA-202)',
)

const volumeRow = read('src/components/workspace/ProposalVolumeRow.tsx')
assert(
  volumeRow.includes('onGenerate?: (volumeId: string) => void'),
  'ProposalVolumeRow must accept onGenerate callback (BDA-202)',
)
assert(
  volumeRow.includes('volume.edited') && volumeRow.includes('Edited'),
  'ProposalVolumeRow must show Edited badge when volume.edited (BDA-206)',
)
assert(
  volumeRow.includes('hand-edited draft'),
  'ProposalVolumeRow must confirm before regenerating edited volumes (BDA-206)',
)
assert(
  volumeRow.includes('focusCitation') && volumeRow.includes('analysisRefs'),
  'ProposalVolumeRow must render analysis ref chips with citation focus (BDA-211)',
)

const proposalPanel = read('src/components/workspace/ProposalGenerationPanel.tsx')
assert(
  proposalPanel.includes('canExportProposalProfile'),
  'ProposalGenerationPanel must gate export on canExportProposalProfile (BDA-176)',
)
assert(
  proposalPanel.includes('runGenerateProposalVolume'),
  'ProposalGenerationPanel must wire single-volume generate (BDA-201)',
)
assert(
  proposalPanel.includes('onGenerate'),
  'ProposalGenerationPanel must pass onGenerate to volume rows (BDA-201)',
)

const volumePreview = read('src/components/workspace/ProposalVolumeMarkdownPreview.tsx')
assert(
  volumePreview.includes('setProposalVolumeBody'),
  'ProposalVolumeMarkdownPreview must save via setProposalVolumeBody (BDA-205)',
)
assert(
  volumePreview.includes('validateProposalVolumeDraft'),
  'ProposalVolumeMarkdownPreview must run draft validation on save (BDA-205)',
)
assert(
  volumePreview.includes('Generate on this volume'),
  'ProposalVolumeMarkdownPreview pending copy must mention per-volume Generate (BDA-205)',
)

const proposalPrompts = read('src/lib/proposal-prompts.ts')
assert(
  proposalPrompts.includes('buildProposalAnalysisRefsBlock'),
  'proposal-prompts must build analysis refs block for section prompts (BDA-210)',
)
assert(
  proposalPrompts.includes('RFP ANALYSIS FINDINGS'),
  'proposal-prompts must emit analysis findings header (BDA-210)',
)

const proposalVolumeEcp = read('src/services/proposal-volume-ecp.ts')
assert(
  proposalVolumeEcp.includes('ProposalSectionEcpResult'),
  'proposal-volume-ecp must return markdown + citations (BDA-212)',
)
assert(
  proposalVolumeEcp.includes('citationsFromFindClauseResult'),
  'proposal-volume-ecp must map find_clause matches to CitationRef (BDA-212)',
)

const assembleProposal = read('src/lib/assemble-proposal-markdown.ts')
assert(
  assembleProposal.includes('exportMode'),
  'assemble-proposal-markdown must support export modes (BDA-213)',
)
assert(
  assembleProposal.includes('### Sources'),
  'assemble-proposal-markdown must append per-volume Sources (BDA-213)',
)

assert(
  proposalPanel.includes('Export drafted volumes'),
  'ProposalGenerationPanel must offer partial export when full gate fails (BDA-214)',
)
assert(
  proposalPanel.includes("'drafted-only'"),
  'ProposalGenerationPanel must call drafted-only assemble (BDA-214)',
)

console.log('[qa:proposal] BDA-218 analyze→propose loop static checks')

assert(
  sessionStore.includes('setProposalVolumeBody'),
  'session-store must define setProposalVolumeBody (BDA-204)',
)

const buildRfpProfile = read('src/services/build-proposal-rfp-profile.ts')
assert(
  buildRfpProfile.includes('mapBaselineCriteriaToProposalVolumes'),
  'build-proposal-rfp-profile must map baseline criteria to volumes (BDA-208)',
)
assert(
  buildRfpProfile.includes('analysisRefs'),
  'build-proposal-rfp-profile must attach analysisRefs on volumes (BDA-208)',
)

assert(
  assembleProposal.includes("'drafted-only'"),
  'assemble-proposal-markdown must support drafted-only export mode (BDA-213)',
)

const analyzeLoopHarnessPath = path.join(root, 'src/services/analyze-propose-loop-harness.ts')
assert(
  existsSync(analyzeLoopHarnessPath),
  'analyze-propose-loop-harness.ts must exist (BDA-218)',
)
const analyzeLoopHarness = read('src/services/analyze-propose-loop-harness.ts')
assert(
  analyzeLoopHarness.includes('runAnalyzeProposeLoopHarness'),
  'analyze-propose-loop-harness must export consolidated loop runner (BDA-218)',
)
assert(
  analyzeLoopHarness.includes('runAnalyzeProposeEditedSiblingHarness'),
  'analyze-propose-loop-harness must assert edited sibling survives generate patch (BDA-218)',
)

const proposalDevHarnesses = read('src/services/proposal-dev-harnesses.ts')
assert(
  proposalDevHarnesses.includes('runAnalyzeProposeLoopHarness'),
  'proposal-dev-harnesses must run consolidated analyze→propose loop harness (BDA-218)',
)

const proposalContextDoc = read('docs/PROPOSAL_CONTEXT_AND_SECTIONS.md')
assert(
  proposalContextDoc.includes('Analyze → propose loop'),
  'PROPOSAL_CONTEXT_AND_SECTIONS must document analyze→propose loop (BDA-218)',
)

console.log(
  '[qa:proposal] PASS BDA-218 analyze→propose loop (BDA-204/208/213 asserts, harness wiring)',
)
console.log(
  '[qa:proposal] Manual UI: TASK_BREAKDOWN_ANALYZE_PROPOSE_LOOP.md § BDA-218 manual checklist',
)

const shareTable = read('src/lib/share-table.ts')
assert(
  String(shareTable.match(/SHARE_PACK_VERSION = (\d+)/)?.[1]) === '2',
  'share-table must use SHARE_PACK_VERSION 2 for proposal tables (BDA-215)',
)
assert(
  shareTable.includes("'proposal_volume_sections'"),
  'share-table registry must include proposal volume sections (BDA-215)',
)

const shareImport = read('src/services/share-pack-import.ts')
assert(
  shareImport.includes('resolveProposalRequirementsProfile'),
  'share-pack-import must hydrate proposal profile from share tables (BDA-216)',
)
assert(
  shareImport.includes('proposalProfileFromShareRows'),
  'share-pack-import must rebuild profile from proposal share rows (BDA-216)',
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

assert(
  existsSync(path.join(root, 'src/lib/scoper-dev-tools.ts')),
  'scoper-dev-tools.ts must expose window.Scoper ECP audit helpers',
)
assert(
  appTsx.includes('runScoperDevToolsHarness'),
  'App dev chain must run runScoperDevToolsHarness',
)
assert(
  architecture.includes('getEcpAgentAuditLog'),
  'ARCHITECTURE.md must document Scoper.getEcpAgentAuditLog dev helper',
)

console.log('[qa:proposal] PASS BDA-195 chat voice wiring (composer, gates, harnesses, docs)')

console.log(
  '[qa:proposal] Manual UI: TASK_BREAKDOWN_CHAT_VOICE.md § BDA-195 manual checklist; baseline BDA-151 in TASK_BREAKDOWN_PROPOSAL_MODE.md',
)
console.log(
  '[qa:proposal] Manual UI: TASK_BREAKDOWN_PROPOSAL_SECTIONAL_UCW.md § BDA-180; baseline BDA-151 in TASK_BREAKDOWN_PROPOSAL_MODE.md',
)

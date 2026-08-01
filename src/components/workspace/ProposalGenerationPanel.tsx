import { useMemo, useState } from 'react'

import { AiSupportLoadingCard } from '@/components/ui/ai-support-loading-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DocumentPickerSelect } from '@/components/workspace/DocumentPickerSelect'
import { ProposalSetupGateList } from '@/components/workspace/ProposalSetupGateList'
import { ProposalVolumeRow } from '@/components/workspace/ProposalVolumeRow'
import {
  assembleProposalMarkdown,
  proposalExportFilename,
} from '@/lib/assemble-proposal-markdown'
import { canExportProposalProfile } from '@/lib/proposal-export-quality'
import { beginBlobSave } from '@/lib/download-blob'
import { PROPOSAL_CONTEXT_MIN_LENGTH } from '@/lib/proposal-readiness'
import { summarizeProposalProfileGeneration } from '@/lib/proposal-volume-section'
import { cn } from '@/lib/utils'
import {
  useProposalRequirementsProfile,
  useProposalSetupState,
  useSessionStore,
} from '@/store/session-store'

type ProposalGenerationPanelProps = {
  className?: string
}

/** Proposal workspace — setup, profile build, volume generation (BDA-130+) */
export function ProposalGenerationPanel({ className }: ProposalGenerationPanelProps) {
  const documents = useSessionStore((s) => s.documents)
  const evaluationDocId = useSessionStore((s) => s.evaluationDocId)
  const companyContext = useSessionStore((s) => s.companyContext)
  const proposalGenerating = useSessionStore((s) => s.proposalGenerating)
  const proposalGenerationError = useSessionStore((s) => s.proposalGenerationError)
  const setEvaluationDocId = useSessionStore((s) => s.setEvaluationDocId)
  const setCompanyContext = useSessionStore((s) => s.setCompanyContext)
  const runProposalRequirementsProfile = useSessionStore((s) => s.runProposalRequirementsProfile)
  const runGenerateProposalVolumes = useSessionStore((s) => s.runGenerateProposalVolumes)

  const setup = useProposalSetupState()
  const profile = useProposalRequirementsProfile()

  const [buildingProfile, setBuildingProfile] = useState(false)
  const [exportingProposal, setExportingProposal] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const rfpDocs = useMemo(
    () => documents.filter((doc) => doc.mime === 'application/pdf' && doc.role !== 'supporting'),
    [documents],
  )

  const canBuildProfile = setup.hasRfp && setup.hasContext && !buildingProfile && !proposalGenerating

  const profileBuildError =
    proposalGenerationError && !setup.hasProfile && !proposalGenerating
      ? proposalGenerationError
      : null
  const volumeGenerationError =
    proposalGenerationError && setup.hasProfile && !proposalGenerating
      ? proposalGenerationError
      : null

  const generationProgress = useMemo(() => {
    if (!profile) return null
    const total = profile.volumes.length
    const draftCount = profile.volumes.filter((v) => v.status === 'draft').length
    const errorCount = profile.volumes.filter((v) => v.status === 'error').length
    const activeVolume = profile.volumes.find((v) => v.status === 'generating')
    const profileGeneration = summarizeProposalProfileGeneration(profile.volumes)
    return {
      total,
      draftCount,
      errorCount,
      activeVolume,
      statusLine: profileGeneration.statusLine,
      sectionProgressLine: profileGeneration.sectionProgressLine,
    }
  }, [profile])

  const allVolumesDraft =
    generationProgress != null &&
    generationProgress.draftCount + generationProgress.errorCount === generationProgress.total &&
    generationProgress.total > 0

  const exportGate = useMemo(
    () => (profile ? canExportProposalProfile(profile) : null),
    [profile],
  )

  const canExportProposal = exportGate?.ok ?? false

  const exportButtonTitle =
    exportGate && !exportGate.ok
      ? exportGate.reasons.slice(0, 2).join(' ')
      : !canExportProposal
        ? 'Complete generation with passing draft quality before exporting'
        : undefined

  async function handleExportProposal() {
    if (!profile || exportingProposal || proposalGenerating) return

    const gate = canExportProposalProfile(profile)
    if (!gate.ok) {
      setExportError(gate.reasons[0] ?? 'Export blocked until all volumes pass quality checks.')
      return
    }

    setExportError(null)
    setExportingProposal(true)

    try {
      const rfpDoc = documents.find((doc) => doc.doc_id === profile.rfp_doc_id)
      const markdown = assembleProposalMarkdown(profile, { rfpFilename: rfpDoc?.filename })
      const filename = proposalExportFilename(rfpDoc?.filename ?? 'proposal')
      const writeBlob = await beginBlobSave({
        filename,
        mime: 'text/markdown',
        extension: '.md',
      })
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
      await writeBlob(blob)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      const message = error instanceof Error ? error.message : 'Export failed'
      setExportError(message)
      console.error('[proposal-generation-panel] markdown export failed', error)
    } finally {
      setExportingProposal(false)
    }
  }

  async function handleBuildProfile() {
    if (!canBuildProfile) return
    setBuildingProfile(true)
    try {
      await runProposalRequirementsProfile()
    } finally {
      setBuildingProfile(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Card className="shrink-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Proposal setup</CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            Select the solicitation RFP and describe your organization&apos;s capabilities as the
            responder — not buyer qualification criteria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proposal-rfp-doc">Solicitation RFP</Label>
            {rfpDocs.length === 0 ? (
              <p className="text-muted-foreground text-xs">Upload an RFP PDF to continue.</p>
            ) : (
              <DocumentPickerSelect
                id="proposal-rfp-doc"
                placeholder="Select RFP document…"
                items={rfpDocs}
                value={evaluationDocId}
                onChange={setEvaluationDocId}
                disabled={buildingProfile || proposalGenerating}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="proposal-company-context">Your company / capabilities</Label>
            <Textarea
              id="proposal-company-context"
              value={companyContext}
              onChange={(event) => setCompanyContext(event.target.value)}
              placeholder="Certifications, past performance, team size, geographic coverage…"
              className="min-h-[7rem] resize-y text-sm"
              disabled={buildingProfile || proposalGenerating}
            />
            <p className="text-muted-foreground text-xs">
              At least {PROPOSAL_CONTEXT_MIN_LENGTH} characters required before building the
              proposal profile.
            </p>
          </div>

          <ProposalSetupGateList
            setup={setup}
            companyContext={companyContext}
            packageWarnings={profile?.packageWarnings}
            exportGate={exportGate}
          />

          {profile && !buildingProfile ? (
            <div
              className="border-border/70 bg-primary/5 space-y-1 rounded-lg border px-3 py-2.5"
              role="status"
            >
              <p className="text-foreground text-xs font-medium">Proposal profile ready</p>
              <p className="text-muted-foreground text-xs leading-relaxed">{profile.summary}</p>
              <p className="text-muted-foreground text-xs tabular-nums">
                {profile.volumes.length} volume{profile.volumes.length === 1 ? '' : 's'} identified
                from the RFP
              </p>
            </div>
          ) : null}

          {profileBuildError ? (
            <p className="text-destructive text-xs leading-relaxed" role="alert">
              {profileBuildError}
            </p>
          ) : null}

          {buildingProfile ? (
            <AiSupportLoadingCard
              label="Building profile"
              buttonLabel="Build proposal profile"
            />
          ) : (
            <Button
              type="button"
              className="w-full"
              disabled={!canBuildProfile}
              onClick={() => void handleBuildProfile()}
            >
              {setup.hasProfile ? 'Rebuild proposal profile' : 'Build proposal profile'}
            </Button>
          )}
        </CardContent>
      </Card>

      {profile ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Proposal volumes</CardTitle>
              <Badge variant="secondary" className="tabular-nums">
                {profile.volumes.length} volume{profile.volumes.length === 1 ? '' : 's'}
              </Badge>
            </div>
            <CardDescription className="text-xs leading-relaxed">
              {profile.summary}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {volumeGenerationError ? (
              <p className="text-destructive text-xs leading-relaxed" role="alert">
                {volumeGenerationError}
              </p>
            ) : null}
            {proposalGenerating && generationProgress ? (
              <p className="text-muted-foreground shrink-0 text-xs leading-relaxed" role="status" aria-live="polite">
                {generationProgress.statusLine}
              </p>
            ) : allVolumesDraft && !proposalGenerating ? (
              <p className="text-muted-foreground shrink-0 text-xs leading-relaxed" role="status">
                {generationProgress!.errorCount > 0
                  ? `${generationProgress!.draftCount} draft${generationProgress!.draftCount === 1 ? '' : 's'} ready, ${generationProgress!.errorCount} volume${generationProgress!.errorCount === 1 ? '' : 's'} failed — regenerate to retry errors.`
                  : 'All volumes have draft content — expand a row to preview markdown.'}
              </p>
            ) : null}
            <ul
              className={cn(
                'grid grid-cols-1 gap-2 sm:grid-cols-2',
                !setup.readyToGenerate &&
                  profile.volumes.every((v) => v.status === 'pending') &&
                  'pointer-events-none',
              )}
            >
              {profile.volumes.map((volume) => (
                <ProposalVolumeRow
                  key={volume.id}
                  volume={volume}
                  muted={!setup.readyToGenerate && volume.status === 'pending'}
                  active={volume.status === 'generating'}
                />
              ))}
            </ul>

            {!setup.readyToGenerate ? (
              <div className="shrink-0 space-y-2">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Complete every item below to enable generation. Volumes stay in preview until
                  setup is valid.
                </p>
                <ProposalSetupGateList setup={setup} variant="compact" />
              </div>
            ) : exportGate && !exportGate.ok ? (
              <ProposalSetupGateList
                setup={setup}
                companyContext={companyContext}
                packageWarnings={profile.packageWarnings}
                variant="compact"
                exportGate={exportGate}
              />
            ) : null}

            {exportError ? (
              <p className="text-destructive shrink-0 text-xs leading-relaxed" role="alert">
                {exportError}
              </p>
            ) : null}

            {proposalGenerating ? (
              <AiSupportLoadingCard
                className="shrink-0"
                label={generationProgress?.sectionProgressLine ?? generationProgress?.statusLine ?? 'Generating'}
                buttonLabel="Generate complete proposal"
              />
            ) : (
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="sm:flex-1"
                  disabled={!canExportProposal || exportingProposal || buildingProfile}
                  title={exportButtonTitle}
                  onClick={() => void handleExportProposal()}
                >
                  {exportingProposal ? 'Exporting…' : 'Export .md'}
                </Button>
                <Button
                  type="button"
                  className="sm:flex-1"
                  disabled={!setup.readyToGenerate || buildingProfile}
                  title={
                    !setup.readyToGenerate
                      ? 'Complete RFP selection, responder context, and proposal profile first'
                      : undefined
                  }
                  onClick={() => void runGenerateProposalVolumes()}
                >
                  {allVolumesDraft ? 'Regenerate complete proposal' : 'Generate complete proposal'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="text-muted-foreground flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 text-center text-sm">
          Build a proposal profile to see solicitation-aligned volumes here.
        </div>
      )}
    </div>
  )
}

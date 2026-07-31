import { useMemo, useState } from 'react'
import { CheckIcon, CircleIcon, Loader2Icon } from 'lucide-react'

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
import { PROPOSAL_CONTEXT_MIN_LENGTH } from '@/lib/proposal-readiness'
import { cn } from '@/lib/utils'
import {
  useProposalRequirementsProfile,
  useProposalSetupState,
  useSessionStore,
} from '@/store/session-store'

type ProposalGenerationPanelProps = {
  className?: string
}

function GateRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? (
        <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <CircleIcon className="text-muted-foreground/50 mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <span className={cn(!ok && 'text-muted-foreground')}>{label}</span>
    </li>
  )
}

function volumeStatusLabel(status: string): string {
  switch (status) {
    case 'generating':
      return 'Generating…'
    case 'draft':
      return 'Draft ready'
    case 'error':
      return 'Error'
    default:
      return 'Pending'
  }
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

  const rfpDocs = useMemo(
    () => documents.filter((doc) => doc.mime === 'application/pdf' && doc.role !== 'supporting'),
    [documents],
  )

  const canBuildProfile = setup.hasRfp && setup.hasContext && !buildingProfile && !proposalGenerating

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
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4', className)}>
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
            />
            <p className="text-muted-foreground text-xs">
              At least {PROPOSAL_CONTEXT_MIN_LENGTH} characters required before building the
              proposal profile.
            </p>
          </div>

          <ul className="border-border/70 space-y-2 rounded-lg border bg-muted/20 px-3 py-3">
            <GateRow ok={setup.hasRfp} label="RFP document selected" />
            <GateRow ok={setup.hasContext} label="Responder context provided" />
            <GateRow ok={setup.hasProfile} label="Proposal profile built from RFP" />
          </ul>

          {proposalGenerationError ? (
            <p className="text-destructive text-xs leading-relaxed" role="alert">
              {proposalGenerationError}
            </p>
          ) : null}

          <Button
            type="button"
            className="w-full"
            disabled={!canBuildProfile}
            onClick={() => void handleBuildProfile()}
          >
            {buildingProfile ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Building proposal profile…
              </>
            ) : (
              'Build proposal profile'
            )}
          </Button>
        </CardContent>
      </Card>

      {profile ? (
        <Card className="min-h-0 flex-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Proposal volumes</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {profile.summary}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            <ul className="scrollbar-none min-h-0 flex-1 space-y-2 overflow-y-auto">
              {profile.volumes.map((volume) => (
                <li
                  key={volume.id}
                  className="border-border/70 flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium leading-snug">{volume.title}</span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {volumeStatusLabel(volume.status)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {volume.requirementSummary}
                  </p>
                  {volume.errorMessage ? (
                    <p className="text-destructive text-xs">{volume.errorMessage}</p>
                  ) : null}
                </li>
              ))}
            </ul>

            <Button
              type="button"
              className="w-full shrink-0"
              disabled={!setup.readyToGenerate || proposalGenerating || buildingProfile}
              onClick={() => void runGenerateProposalVolumes()}
            >
              {proposalGenerating ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Generating complete proposal…
                </>
              ) : (
                'Generate complete proposal'
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="text-muted-foreground flex min-h-[12rem] flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 text-center text-sm">
          Build a proposal profile to see solicitation-aligned volumes here.
        </div>
      )}
    </div>
  )
}

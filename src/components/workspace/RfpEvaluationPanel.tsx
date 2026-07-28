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
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { DocumentMeta } from '@/lib/types'
import { CriterionRow } from '@/components/workspace/CriterionRow'
import type { CitationRef } from '@/lib/types'
import { draftCompanyContext } from '@/lib/draft-company-context'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'
import { setDocumentRole } from '@/services/document-roles'
import { useSessionStore } from '@/store/session-store'

type RfpEvaluationPanelProps = {
  className?: string
}

const CONTEXT_STARTER = `Organization: [your team / agency]
Industry: [e.g. public sector IT procurement]
Must-haves: [certifications, insurance floors, pricing model]
Deal-breakers: [e.g. no T&M-only, offshore restrictions]
Evaluation priority: [cost / compliance / delivery speed]`

const CONTEXT_SNIPPETS = [
  'Requires CMMI Level 3 or equivalent',
  '$2M general liability minimum',
  'Fixed-fee / milestone pricing only',
  'US data residency required',
  '99.9% uptime SLA mandatory',
  'Local presence / on-site support required',
] as const

const CONTEXT_GUIDE = [
  'Who you are — buyer org, sector, and risk posture',
  'Non-negotiables — certs, insurance, security, pricing model',
  'Deal-breakers — terms that should fail a bidder outright',
  'Weighting — what matters most if trade-offs appear',
] as const

function appendContextSnippet(current: string, snippet: string): string {
  const trimmed = current.trim()
  if (!trimmed) return snippet
  if (trimmed.includes(snippet)) return trimmed
  return `${trimmed} · ${snippet}`
}

function CompanyContextAssistant({
  companyContext,
  onApply,
  focusAreas,
}: {
  companyContext: string
  onApply: (value: string) => void
  focusAreas: string[]
}) {
  const [generating, setGenerating] = useState(false)

  async function handleGenerate() {
    setGenerating(true)
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 2200))
      onApply(draftCompanyContext(focusAreas))
    } finally {
      setGenerating(false)
    }
  }

  if (generating) {
    return <AiSupportLoadingCard label="Generating" buttonLabel="Generate buyer profile" />
  }

  return (
    <Card size="sm" className="bg-muted/30 ring-foreground/10 gap-3 py-3">
      <CardHeader className="gap-1 px-3 pb-0">
        <CardTitle className="text-sm">Buyer profile helper</CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          Plain-language notes steer qualification. Mention terms like CMMI, insurance, or
          fixed-fee to treat matching RFP clauses as mandatory.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 px-3">
        <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-xs leading-relaxed">
          {CONTEXT_GUIDE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-1.5">
          {CONTEXT_SNIPPETS.map((snippet) => (
            <Button
              key={snippet}
              type="button"
              variant="outline"
              size="xs"
              className="h-auto whitespace-normal px-2 py-1 text-left"
              onClick={() => onApply(appendContextSnippet(companyContext, snippet))}
            >
              {snippet}
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" size="sm" className="sm:flex-1" onClick={() => void handleGenerate()}>
            Generate buyer profile
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="sm:flex-1"
            onClick={() => onApply(CONTEXT_STARTER)}
          >
            {companyContext.trim() ? 'Use starter template' : 'Insert starter template'}
          </Button>
        </div>

        {focusAreas.length > 0 ? (
          <div className="border-border/70 space-y-2 border-t pt-3">
            <p className="text-muted-foreground text-xs font-medium">Detected in requirements doc</p>
            <div className="flex flex-wrap gap-1.5">
              {focusAreas.map((area) => (
                <Badge key={area} variant="secondary">
                  {area}
                </Badge>
              ))}
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Add stricter buyer rules above if your bar is higher than the RFP minimum.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Right-side panel — buyer context + requirements doc to qualify responses against */
export function RfpEvaluationPanel({ className }: RfpEvaluationPanelProps) {
  const documents = useSessionStore((s) => s.documents)
  const evaluationDocId = useSessionStore((s) => s.evaluationDocId)
  const companyContext = useSessionStore((s) => s.companyContext)
  const baselineProfile = useSessionStore((s) => s.evaluationBaselineProfile)
  const setEvaluationDocId = useSessionStore((s) => s.setEvaluationDocId)
  const setCompanyContext = useSessionStore((s) => s.setCompanyContext)
  const clearEvaluationSetup = useSessionStore((s) => s.clearEvaluationSetup)
  const runRfpQualification = useSessionStore((s) => s.runRfpQualification)
  const setUploadPopupOpen = useSessionStore((s) => s.setUploadPopupOpen)

  const [running, setRunning] = useState(false)

  const requirementDocs = documents.filter((doc) => doc.role !== 'supporting')
  const responseCount = documents.filter(
    (doc) => doc.doc_id !== evaluationDocId && doc.role !== 'supporting',
  ).length

  const focusAreas = useMemo(
    () => baselineProfile?.criteria.map((criterion) => criterion.label) ?? [],
    [baselineProfile],
  )

  const selectedRequirementDoc = useMemo(
    () => requirementDocs.find((doc) => doc.doc_id === evaluationDocId) ?? null,
    [requirementDocs, evaluationDocId],
  )

  const hasEvaluationSetup = Boolean(
    companyContext.trim() || evaluationDocId || baselineProfile,
  )

  async function handleBaselineChange(docId: string) {
    setEvaluationDocId(docId || null)
    if (docId) {
      try {
        await setDocumentRole(docId, 'baseline')
      } catch (error) {
        console.error('[evaluation-panel] set baseline role failed', error)
      }
    }
  }

  async function handleRunQualification() {
    if (!evaluationDocId) return
    setRunning(true)
    try {
      await runRfpQualification()
    } catch (error) {
      console.error('[evaluation-panel] qualification failed', error)
    } finally {
      setRunning(false)
    }
  }

  function handleClearEvaluation() {
    clearEvaluationSetup()
  }

  function handleCriterionClick(citation: CitationRef) {
    focusCitation(citation)
  }

  return (
    <Card
      className={cn(
        'border-border bg-surface shadow-panel flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-xl border py-0 ring-0',
        className,
      )}
    >
      <CardHeader className="border-border/70 shrink-0 border-b px-4 py-4">
        <CardTitle>Evaluation setup</CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          Describe your organization and pick the requirements document. Bidder uploads are scored
          against that baseline.
        </CardDescription>
      </CardHeader>

      <CardContent className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="company-context">Your organization</Label>
            <Textarea
              id="company-context"
              value={companyContext}
              onChange={(event) => setCompanyContext(event.target.value)}
              rows={4}
              placeholder="e.g. Enterprise IT buyer · requires CMMI L3 · $2M liability minimum · fixed-fee pricing preferred"
            />
            <CompanyContextAssistant
              companyContext={companyContext}
              onApply={setCompanyContext}
              focusAreas={focusAreas}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="evaluation-doc">Requirements profile (RFP / SOW)</Label>
            {requirementDocs.length === 0 ? (
              <div className="border-border bg-muted/30 rounded-lg border border-dashed px-3 py-4 text-center">
                <p className="text-muted-foreground text-sm">Upload an RFP or requirements doc first.</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setUploadPopupOpen(true)}
                >
                  Upload document
                </Button>
              </div>
            ) : (
              <Combobox
                items={requirementDocs}
                itemToStringValue={(doc: DocumentMeta) => doc.filename}
                value={selectedRequirementDoc}
                onValueChange={(doc) => void handleBaselineChange(doc?.doc_id ?? '')}
              >
                <ComboboxInput
                  id="evaluation-doc"
                  placeholder="Select requirements document…"
                  className="w-full"
                />
                <ComboboxContent>
                  <ComboboxEmpty>No documents found.</ComboboxEmpty>
                  <ComboboxList>
                    {(doc: DocumentMeta) => (
                      <ComboboxItem key={doc.doc_id} value={doc}>
                        {doc.filename}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            )}
            <p className="text-muted-foreground text-xs leading-relaxed">
              This document defines what bidders must meet. It won&apos;t appear as a qualification
              card.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="min-w-0 flex-1"
              disabled={!evaluationDocId || running}
              onClick={() => void handleRunQualification()}
            >
              {running ? 'Running qualification…' : 'Run qualification'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={running || !hasEvaluationSetup}
              onClick={handleClearEvaluation}
            >
              Clear
            </Button>
          </div>

          {evaluationDocId && responseCount === 0 ? (
            <p className="text-muted-foreground rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Baseline set. Upload bidder responses, then run qualification again to compare profiles.
            </p>
          ) : null}

          {running ? (
            <AiSupportLoadingCard
              label="Qualifying"
              buttonLabel="Running qualification"
            />
          ) : null}

          {baselineProfile && !running ? (
            <section className="border-border/70 space-y-3 border-t pt-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Requirements extracted</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{baselineProfile.summary}</p>
              </div>
              <div className="space-y-2">
                {baselineProfile.criteria.map((criterion) => (
                  <CriterionRow
                    key={criterion.id}
                    criterion={criterion}
                    onCriterionClick={handleCriterionClick}
                    className="py-2"
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

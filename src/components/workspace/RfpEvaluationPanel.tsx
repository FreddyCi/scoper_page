import { useMemo, useState, useEffect } from 'react'

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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DocumentPickerSelect } from '@/components/workspace/DocumentPickerSelect'
import { CriterionRow } from '@/components/workspace/CriterionRow'
import { ComplianceMatrix } from '@/components/workspace/ComplianceMatrix'
import { InstructionsCard } from '@/components/workspace/InstructionsCard'
import type { CitationRef } from '@/lib/types'
import { draftCompanyContext } from '@/lib/draft-company-context'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'
import { loadSampleBidderResponse } from '@/services/load-sample-documents'
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

const SNIPPET_SEPARATOR = ' · '

function getSelectedSnippets(context: string): string[] {
  return CONTEXT_SNIPPETS.filter((snippet) => context.includes(snippet))
}

function splitCompanyContext(context: string): { freeform: string; snippets: string[] } {
  let freeform = context
  for (const snippet of CONTEXT_SNIPPETS) {
    freeform = freeform.split(snippet).join('')
  }

  freeform = freeform
    .split(SNIPPET_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(SNIPPET_SEPARATOR)
    .trim()

  return { freeform, snippets: getSelectedSnippets(context) }
}

function buildCompanyContext(freeform: string, snippets: string[]): string {
  return [freeform.trim(), ...snippets].filter(Boolean).join(SNIPPET_SEPARATOR)
}

const CONTEXT_GUIDE = [
  'Who you are — buyer org, sector, and risk posture',
  'Non-negotiables — certs, insurance, security, pricing model',
  'Deal-breakers — terms that should fail a bidder outright',
  'Weighting — what matters most if trade-offs appear',
] as const

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
  const selectedSnippets = getSelectedSnippets(companyContext)

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

        <ToggleGroup
          multiple
          variant="outline"
          size="sm"
          spacing={2}
          className="flex w-full flex-wrap"
          value={selectedSnippets}
          onValueChange={(values) => {
            const { freeform } = splitCompanyContext(companyContext)
            onApply(buildCompanyContext(freeform, values))
          }}
        >
          {CONTEXT_SNIPPETS.map((snippet) => (
            <ToggleGroupItem
              key={snippet}
              value={snippet}
              className="h-auto min-h-7 whitespace-normal px-2 py-1 text-left text-xs aria-pressed:font-semibold data-[state=on]:font-semibold"
            >
              {snippet}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

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
  const contractChecklistDocId = useSessionStore((s) => s.contractChecklistDocId)
  const contractReviewProfile = useSessionStore((s) => s.contractReviewProfile)
  const companyContext = useSessionStore((s) => s.companyContext)
  const baselineProfile = useSessionStore((s) => s.evaluationBaselineProfile)
  const rfpInstructionsProfile = useSessionStore((s) => s.rfpInstructionsProfile)
  const setEvaluationDocId = useSessionStore((s) => s.setEvaluationDocId)
  const setContractChecklistDocId = useSessionStore((s) => s.setContractChecklistDocId)
  const runContractKeywordReview = useSessionStore((s) => s.runContractKeywordReview)
  const setCompanyContext = useSessionStore((s) => s.setCompanyContext)
  const clearEvaluationSetup = useSessionStore((s) => s.clearEvaluationSetup)
  const runRfpQualification = useSessionStore((s) => s.runRfpQualification)
  const openUploadPopup = useSessionStore((s) => s.openUploadPopup)

  const [running, setRunning] = useState(false)
  const [runningKeywordCheck, setRunningKeywordCheck] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)

  const checklistDocs = useMemo(
    () =>
      documents.filter(
        (doc) =>
          doc.mime === 'text/markdown' ||
          doc.mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    [documents],
  )

  const contractDocs = useMemo(
    () => documents.filter((doc) => doc.mime === 'application/pdf' && doc.role !== 'supporting'),
    [documents],
  )

  const requirementDocs = documents.filter((doc) => doc.role !== 'supporting')
  const responseCount = documents.filter(
    (doc) => doc.doc_id !== evaluationDocId && doc.role !== 'supporting',
  ).length

  const focusAreas = useMemo(
    () => baselineProfile?.criteria.map((criterion) => criterion.label) ?? [],
    [baselineProfile],
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

  async function handleLoadDemoResponse() {
    setLoadingDemo(true)
    try {
      await loadSampleBidderResponse()
    } catch (error) {
      console.error('[evaluation-panel] demo response load failed', error)
    } finally {
      setLoadingDemo(false)
    }
  }

  async function handleRunKeywordCheck() {
    setRunningKeywordCheck(true)
    try {
      await runContractKeywordReview()
    } catch (error) {
      console.error('[evaluation-panel] keyword check failed', error)
    } finally {
      setRunningKeywordCheck(false)
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

  useEffect(() => {
    if (contractChecklistDocId || checklistDocs.length === 0) return
    setContractChecklistDocId(checklistDocs[0]!.doc_id)
  }, [checklistDocs, contractChecklistDocId, setContractChecklistDocId])

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
          <section className="border-border/70 space-y-3 rounded-lg border bg-violet-50/40 px-3 py-3">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Contract keyword check</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Run a keyword checklist (Word or markdown) against a contract PDF. Results appear as
                a profile card with cited rows — or ask in chat: &quot;run keyword check&quot;.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Label htmlFor="contract-checklist-doc" className="leading-snug">
                Keyword checklist
              </Label>
              {checklistDocs.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  Upload the checklist as .docx or .md.
                </p>
              ) : (
                <DocumentPickerSelect
                  id="contract-checklist-doc"
                  placeholder="Select checklist…"
                  items={checklistDocs}
                  value={contractChecklistDocId}
                  onChange={setContractChecklistDocId}
                />
              )}
            </div>

            <div className="flex flex-col gap-3">
              <Label htmlFor="contract-under-review" className="leading-snug">
                Contract under review
              </Label>
              {contractDocs.length === 0 ? (
                <p className="text-muted-foreground text-xs">Upload the executed contract PDF.</p>
              ) : (
                <DocumentPickerSelect
                  id="contract-under-review"
                  placeholder="Select contract PDF…"
                  items={contractDocs}
                  value={evaluationDocId}
                  onChange={(docId) => void handleBaselineChange(docId ?? '')}
                />
              )}
            </div>

            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={!evaluationDocId || runningKeywordCheck}
              onClick={() => void handleRunKeywordCheck()}
            >
              {runningKeywordCheck ? 'Running keyword check…' : 'Run keyword check'}
            </Button>

            {contractReviewProfile && !runningKeywordCheck ? (
              <div className="border-border/70 space-y-2 border-t pt-3">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {contractReviewProfile.summary}
                </p>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {contractReviewProfile.criteria.slice(0, 6).map((criterion) => (
                    <CriterionRow
                      key={criterion.id}
                      criterion={criterion}
                      onCriterionClick={handleCriterionClick}
                      className="py-2"
                    />
                  ))}
                </div>
                {contractReviewProfile.criteria.length > 6 ? (
                  <p className="text-muted-foreground text-xs">
                    +{contractReviewProfile.criteria.length - 6} more rows on the profile card
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3">
              <Label htmlFor="company-context" className="leading-snug">
                Your organization
              </Label>
              <Textarea
                id="company-context"
                value={companyContext}
                onChange={(event) => setCompanyContext(event.target.value)}
                rows={4}
                placeholder="e.g. Enterprise IT buyer · requires CMMI L3 · $2M liability minimum · fixed-fee pricing preferred"
              />
            </div>
            <CompanyContextAssistant
              companyContext={companyContext}
              onApply={setCompanyContext}
              focusAreas={focusAreas}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3">
              <Label htmlFor="evaluation-doc" className="leading-snug">
                Requirements profile (RFP / SOW)
              </Label>
              {requirementDocs.length === 0 ? (
                <div className="border-border bg-muted/30 rounded-lg border border-dashed px-3 py-4 text-center">
                  <p className="text-muted-foreground text-sm">Upload an RFP or requirements doc first.</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => openUploadPopup('rfp')}
                  >
                    Upload document
                  </Button>
                </div>
              ) : (
                <DocumentPickerSelect
                  id="evaluation-doc"
                  placeholder="Select requirements document…"
                  items={requirementDocs}
                  value={evaluationDocId}
                  onChange={(docId) => void handleBaselineChange(docId ?? '')}
                />
              )}
            </div>
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
            <div className="space-y-2 rounded-lg bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-900">
                Baseline set. Upload bidder responses, then run qualification again to compare
                profiles.
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 bg-white/80"
                disabled={loadingDemo || running}
                onClick={() => void handleLoadDemoResponse()}
              >
                {loadingDemo ? 'Loading demo…' : 'Load demo response'}
              </Button>
            </div>
          ) : null}

          {running ? (
            <AiSupportLoadingCard
              label="Qualifying"
              buttonLabel="Running qualification"
            />
          ) : null}

          {baselineProfile && !running ? (
            <>
              {rfpInstructionsProfile ? (
                <InstructionsCard
                  variant="evaluation"
                  onCitationClick={handleCriterionClick}
                />
              ) : null}
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
              <ComplianceMatrix onCitationClick={handleCriterionClick} />
            </section>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

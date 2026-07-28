import { useMemo, useState } from 'react'
import {
  Building2Icon,
  ClipboardListIcon,
  LightbulbIcon,
  PlayIcon,
  SparklesIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CriterionRow } from '@/components/workspace/CriterionRow'
import type { CitationRef } from '@/lib/types'
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
  return (
    <div className="border-border/70 bg-workspace/60 space-y-3 rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <SparklesIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="text-foreground text-xs font-medium">How to fill this in</p>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Plain-language buyer notes steer qualification. Mention keywords like{' '}
            <span className="text-foreground">CMMI</span>,{' '}
            <span className="text-foreground">insurance</span>, or{' '}
            <span className="text-foreground">fixed-fee</span> to treat matching RFP clauses as
            mandatory.
          </p>
        </div>
      </div>

      <ul className="text-muted-foreground space-y-1 pl-5 text-[11px] leading-snug">
        {CONTEXT_GUIDE.map((item) => (
          <li key={item} className="list-disc">
            {item}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-1.5">
        {CONTEXT_SNIPPETS.map((snippet) => (
          <button
            key={snippet}
            type="button"
            onClick={() => onApply(appendContextSnippet(companyContext, snippet))}
            className="border-border bg-surface text-foreground hover:bg-muted rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors"
          >
            + {snippet}
          </button>
        ))}
      </div>

      <Button
        type="button"
        size="xs"
        variant="outline"
        className="w-full"
        onClick={() => onApply(CONTEXT_STARTER)}
      >
        <LightbulbIcon className="size-3" />
        {companyContext.trim() ? 'Replace with starter template' : 'Insert starter template'}
      </Button>

      {focusAreas.length > 0 ? (
        <div className="border-border/60 border-t pt-2">
          <p className="text-muted-foreground mb-1.5 text-[10px] font-medium tracking-wide uppercase">
            Detected in requirements doc
          </p>
          <div className="flex flex-wrap gap-1">
            {focusAreas.map((area) => (
              <span
                key={area}
                className="bg-surface text-muted-foreground rounded-md px-1.5 py-0.5 text-[10px]"
              >
                {area}
              </span>
            ))}
          </div>
          <p className="text-muted-foreground mt-1.5 text-[10px] leading-snug">
            Add stricter buyer rules above if your bar is higher than the RFP minimum.
          </p>
        </div>
      ) : null}
    </div>
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

  function handleCriterionClick(citation: CitationRef) {
    focusCitation(citation)
  }

  return (
    <aside
      className={cn(
        'border-border bg-surface flex h-full min-h-0 flex-col overflow-hidden rounded-xl border shadow-panel',
        className,
      )}
    >
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          <header className="space-y-1">
            <div className="flex items-center gap-2">
              <Building2Icon className="text-muted-foreground size-4" />
              <h2 className="text-foreground text-sm font-semibold">Evaluation setup</h2>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Describe your organization and pick the requirements document. Bidder uploads are scored
              against that baseline.
            </p>
          </header>

          <section className="space-y-2">
            <label className="text-foreground block text-xs font-medium" htmlFor="company-context">
              Your organization
            </label>
            <textarea
              id="company-context"
              value={companyContext}
              onChange={(event) => setCompanyContext(event.target.value)}
              rows={4}
              placeholder="e.g. Enterprise IT buyer · requires CMMI L3 · $2M liability minimum · fixed-fee pricing preferred"
              className="border-border bg-workspace text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-3"
            />
            <CompanyContextAssistant
              companyContext={companyContext}
              onApply={setCompanyContext}
              focusAreas={focusAreas}
            />
          </section>

          <section className="space-y-2">
            <label className="text-foreground block text-xs font-medium" htmlFor="evaluation-doc">
              Requirements profile (RFP / SOW)
            </label>
            {requirementDocs.length === 0 ? (
              <div className="border-border bg-muted/30 rounded-lg border border-dashed px-3 py-4 text-center">
                <p className="text-muted-foreground text-xs">Upload an RFP or requirements doc first.</p>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setUploadPopupOpen(true)}
                >
                  Upload document
                </Button>
              </div>
            ) : (
              <select
                id="evaluation-doc"
                value={evaluationDocId ?? ''}
                onChange={(event) => void handleBaselineChange(event.target.value)}
                className="border-border bg-workspace text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
              >
                <option value="">Select requirements document…</option>
                {requirementDocs.map((doc) => (
                  <option key={doc.doc_id} value={doc.doc_id}>
                    {doc.filename}
                  </option>
                ))}
              </select>
            )}
            <p className="text-muted-foreground text-[11px] leading-snug">
              This document defines what bidders must meet. It won&apos;t appear as a qualification card.
            </p>
          </section>

          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={!evaluationDocId || running}
            onClick={() => void handleRunQualification()}
          >
            <PlayIcon className="size-3.5" />
            {running ? 'Running qualification…' : 'Run qualification'}
          </Button>

          {evaluationDocId && responseCount === 0 ? (
            <p className="text-muted-foreground rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Baseline set. Upload bidder responses, then run qualification again to compare profiles.
            </p>
          ) : null}

          {baselineProfile ? (
            <section className="border-border/70 space-y-2 border-t pt-4">
              <div className="flex items-center gap-2">
                <ClipboardListIcon className="text-muted-foreground size-3.5" />
                <h3 className="text-foreground text-xs font-semibold">Requirements extracted</h3>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">{baselineProfile.summary}</p>
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
      </div>
    </aside>
  )
}

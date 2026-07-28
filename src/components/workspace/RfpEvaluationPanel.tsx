import { useState } from 'react'
import { Building2Icon, ClipboardListIcon, PlayIcon } from 'lucide-react'

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
        'border-border bg-surface flex min-h-0 flex-col gap-4 rounded-xl border p-4 shadow-panel',
        className,
      )}
    >
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
        <p className="text-muted-foreground text-[11px] leading-snug">
          Optional buyer context — steers which requirement areas are treated as mandatory.
        </p>
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
        <section className="border-border/70 min-h-0 flex-1 space-y-2 border-t pt-4">
          <div className="flex items-center gap-2">
            <ClipboardListIcon className="text-muted-foreground size-3.5" />
            <h3 className="text-foreground text-xs font-semibold">Requirements extracted</h3>
          </div>
          <p className="text-muted-foreground text-[11px] leading-relaxed">{baselineProfile.summary}</p>
          <div className="scrollbar-none max-h-[min(18rem,40vh)] space-y-2 overflow-y-auto pr-0.5">
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
    </aside>
  )
}

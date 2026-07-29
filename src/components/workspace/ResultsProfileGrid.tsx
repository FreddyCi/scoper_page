import { useEffect, useState } from 'react'
import { ClipboardCheckIcon, SparklesIcon, UploadIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ResultsProfileCard } from '@/components/workspace/ResultsProfileCard'
import { promptBidderUploadOnce } from '@/lib/upload-suggestions'
import type { CitationRef, RfpResultsProfile } from '@/lib/types'
import { cn } from '@/lib/utils'
import { focusCitation } from '@/services/citation-bridge'
import { loadSampleBidderResponse } from '@/services/load-sample-documents'
import {
  useBidderResponseCount,
  useSessionStore,
} from '@/store/session-store'

type ResultsProfileGridProps = {
  profiles: RfpResultsProfile[]
  onCriterionClick?: (citation: CitationRef) => void
  className?: string
}

function EmptyQualificationState() {
  const evaluationDocId = useSessionStore((s) => s.evaluationDocId)
  const baselineProfile = useSessionStore((s) => s.evaluationBaselineProfile)
  const responseCount = useBidderResponseCount()
  const openUploadPopup = useSessionStore((s) => s.openUploadPopup)
  const runRfpQualification = useSessionStore((s) => s.runRfpQualification)
  const [running, setRunning] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)

  const hasBaseline = Boolean(evaluationDocId || baselineProfile)
  const needsBidderUpload = hasBaseline && responseCount === 0
  const needsQualificationRun = hasBaseline && responseCount > 0

  useEffect(() => {
    if (!needsBidderUpload) return
    promptBidderUploadOnce(openUploadPopup)
  }, [needsBidderUpload, openUploadPopup])

  async function handleLoadDemoResponse() {
    setDemoError(null)
    setLoadingDemo(true)
    try {
      await loadSampleBidderResponse()
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : 'Failed to load demo response')
    } finally {
      setLoadingDemo(false)
    }
  }

  async function handleRunQualification() {
    setRunning(true)
    try {
      await runRfpQualification()
    } catch (error) {
      console.error('[results-profile-grid] qualification failed', error)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="text-muted-foreground flex h-full min-h-[16rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-8 text-center">
      <p className="text-foreground text-sm font-medium">No bidder qualification cards yet</p>

      {!hasBaseline ? (
        <p className="max-w-sm text-xs leading-relaxed">
          Set a requirements profile and your organization context in Evaluation setup on the
          right, then run qualification.
        </p>
      ) : needsBidderUpload ? (
        <>
          <p className="max-w-sm text-xs leading-relaxed">
            Requirements are set. Upload at least one bidder response (proposal PDF, Word, or
            Excel), then run qualification to generate cards here.
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={loadingDemo}
              onClick={() => void handleLoadDemoResponse()}
            >
              <SparklesIcon className="size-3.5" />
              {loadingDemo ? 'Loading demo…' : 'Load demo response'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openUploadPopup('rfp')}
            >
              <UploadIcon className="size-3.5" />
              Upload bidder response
            </Button>
          </div>
          {demoError ? <p className="text-destructive max-w-sm text-xs">{demoError}</p> : null}
        </>
      ) : needsQualificationRun ? (
        <>
          <p className="max-w-sm text-xs leading-relaxed">
            {responseCount} response{responseCount === 1 ? '' : 's'} ready. Run qualification to
            score bidders against your requirements.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-1"
            disabled={running}
            onClick={() => void handleRunQualification()}
          >
            {running ? 'Running qualification…' : 'Run qualification'}
          </Button>
        </>
      ) : (
        <p className="max-w-sm text-xs leading-relaxed">
          Upload bidder responses and run qualification to populate this panel.
        </p>
      )}
    </div>
  )
}

export function ResultsProfileGrid({
  profiles,
  onCriterionClick,
  className,
}: ResultsProfileGridProps) {
  if (profiles.length === 0) {
    return (
      <div className={cn('min-h-0 flex-1', className)}>
        <EmptyQualificationState />
      </div>
    )
  }

  function handleCriterionClick(citation: CitationRef) {
    if (onCriterionClick) {
      onCriterionClick(citation)
      return
    }
    focusCitation(citation)
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4', className)}>
      <header className="flex shrink-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <ClipboardCheckIcon className="text-muted-foreground size-4" />
          <h2 className="text-foreground text-sm font-semibold">Qualification profiles</h2>
          <span className="bg-muted text-muted-foreground rounded-pill px-2 py-0.5 text-xs font-medium tabular-nums">
            {profiles.length}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          Click a criterion to open split view with source highlight
        </p>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pb-2">
        <div className="flex flex-col gap-4">
          {profiles.map((profile) => (
            <ResultsProfileCard
              key={profile.profile_id}
              profile={profile}
              onCriterionClick={handleCriterionClick}
              className="w-full min-w-0"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

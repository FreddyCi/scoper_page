import { useCallback, useRef, useState } from 'react'

import { ScoutJourneyPicker } from '@/components/scout/ScoutJourneyPicker'
import { QuickActionCards } from '@/components/workspace/QuickActionCards'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type WorkspaceLandingProps = {
  className?: string
}

export function WorkspaceLanding({ className }: WorkspaceLandingProps) {
  const [showOwnUpload, setShowOwnUpload] = useState(false)
  const uploadSectionRef = useRef<HTMLDivElement>(null)

  const handleShowOwnUpload = useCallback(() => {
    setShowOwnUpload(true)
    requestAnimationFrame(() => {
      uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [])

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col items-center justify-center px-[var(--spacing-panel)] py-10',
        className,
      )}
    >
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <p className="text-subtle-foreground text-xs font-medium tracking-[0.2em] uppercase">
          Scoper Scout
        </p>
        <h1 className="text-foreground font-serif mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
          Qualify subs, mark plans, export CSV
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl text-sm leading-relaxed">
          Pick a guided tour with sample construction docs — DPR bid packages, proposal rubrics, and
          plan sheets. Everything parses locally in your browser; nothing is uploaded to a server.
        </p>
      </div>

      <ScoutJourneyPicker className="mt-8 max-w-5xl sm:mt-10" />

      <div className="mt-8 flex flex-col items-center gap-3 sm:mt-10">
        <Button type="button" variant="link" className="text-muted-foreground h-auto px-0 text-sm" onClick={handleShowOwnUpload}>
          I&apos;ll upload my own files
        </Button>

        {showOwnUpload ? (
          <div ref={uploadSectionRef} className="w-full max-w-4xl pt-2">
            <p className="text-muted-foreground mb-4 text-center text-xs leading-relaxed">
              Upload your RFP, proposals, or drawing PDFs — same local parsing, no Scout checklist.
            </p>
            <QuickActionCards />
          </div>
        ) : null}
      </div>
    </div>
  )
}

import { CircleCheckIcon, CircleIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  featureCardAccent,
  featureCardDescriptionClass,
  featureCardTitleClass,
} from '@/components/workspace/feature-card-styles'
import { SCOUT_TARGETS, scoutTargetProps } from '@/lib/scout/targets'
import {
  UPLOAD_SUGGESTIONS,
  workspaceModeForSuggestionId,
  type UploadIntent,
} from '@/lib/upload-suggestions'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

function activeSuggestionId(mode: string, uploadIntent: UploadIntent): string {
  if (uploadIntent === 'context') return 'upload-context'
  if (mode === 'proposal') return 'generate-complete-proposal'
  return 'analyse-rfp'
}

/** Workflow tiles inside the upload popup — replaces landing QuickActionCards (BDA-308). */
export function UploadWorkflowPicker({ className }: { className?: string }) {
  const mode = useSessionStore((s) => s.mode)
  const uploadIntent = useSessionStore((s) => s.uploadIntent)
  const hasDocuments = useSessionStore((s) => s.documents.length > 0)
  const selectUploadWorkflow = useSessionStore((s) => s.selectUploadWorkflow)

  const activeId = activeSuggestionId(mode, uploadIntent)

  return (
    <div
      {...scoutTargetProps(SCOUT_TARGETS.quickActions)}
      className={cn('grid grid-cols-1 gap-2 sm:grid-cols-3', className)}
    >
      {UPLOAD_SUGGESTIONS.map((action, index) => {
        const disabled = action.disabled ?? false
        const selected = action.id === activeId

        return (
          <button
            key={action.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => selectUploadWorkflow(action.id)}
            className={cn(
              'border-border/70 relative rounded-xl border px-3 py-3 text-left transition-[border-color,box-shadow]',
              featureCardAccent(index),
              selected && 'ring-primary/35 ring-2',
              disabled
                ? 'cursor-not-allowed opacity-45 saturate-50'
                : 'hover:border-border cursor-pointer',
            )}
          >
            {selected ? (
              <CircleCheckIcon
                className="text-primary absolute top-2.5 right-2.5 size-4"
                aria-hidden
              />
            ) : (
              <CircleIcon
                className="text-muted-foreground/45 absolute top-2.5 right-2.5 size-4"
                aria-hidden
              />
            )}
            <div className="flex flex-wrap items-center gap-2 pr-5">
              <span className={cn(featureCardTitleClass, 'text-base')}>{action.label}</span>
              {disabled ? (
                <Badge variant="secondary" className="text-[10px] font-medium tracking-wide uppercase">
                  Coming soon
                </Badge>
              ) : null}
            </div>
            <p className={cn(featureCardDescriptionClass, 'mt-1 text-left text-xs')}>
              {action.description}
            </p>
            {hasDocuments && workspaceModeForSuggestionId(action.id) ? (
              <p className="text-muted-foreground mt-1.5 text-[11px] leading-snug">
                Switches workspace view when you already have documents loaded.
              </p>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

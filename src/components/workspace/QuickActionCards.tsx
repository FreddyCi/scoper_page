import type { LucideIcon } from 'lucide-react'
import {
  ClipboardCheckIcon,
  GitCompareArrowsIcon,
  UploadIcon,
} from 'lucide-react'

import {
  featureCardAccent,
  featureCardDescriptionClass,
  featureCardInnerPanelClass,
  featureCardShellClass,
  featureCardTitleClass,
} from '@/components/workspace/feature-card-styles'
import { cn } from '@/lib/utils'
import type { WorkspaceMode } from '@/lib/types'
import { useSessionStore } from '@/store/session-store'

type QuickAction = {
  id: string
  label: string
  description: string
  icon: LucideIcon
  mode?: WorkspaceMode
  openUpload?: boolean
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'analyse-rfp',
    label: 'Analyse RFP',
    description: 'Qualify bidders against your requirements profile',
    icon: ClipboardCheckIcon,
    mode: 'rfp',
    openUpload: true,
  },
  {
    id: 'scope-creep',
    label: 'Check scope creep',
    description: 'Compare baseline scope against change requests',
    icon: GitCompareArrowsIcon,
    mode: 'scope_creep',
    openUpload: true,
  },
  {
    id: 'upload-docs',
    label: 'Upload docs',
    description: 'Add RFP, bidder responses, and supporting context',
    icon: UploadIcon,
    openUpload: true,
  },
]

export function QuickActionCards({ className }: { className?: string }) {
  const setMode = useSessionStore((s) => s.setMode)
  const setUploadPopupOpen = useSessionStore((s) => s.setUploadPopupOpen)

  function handleSelect(action: QuickAction) {
    if (action.mode) setMode(action.mode)
    if (action.openUpload) setUploadPopupOpen(true)
  }

  return (
    <div
      className={cn(
        'grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3',
        className,
      )}
    >
      {QUICK_ACTIONS.map((action, index) => {
        const Icon = action.icon

        return (
          <button
            key={action.id}
            type="button"
            onClick={() => handleSelect(action)}
            className={cn('group text-left', featureCardShellClass, featureCardAccent(index))}
          >
            <div className="px-2 text-center">
              <h3 className={featureCardTitleClass}>{action.label}</h3>
              <p className={featureCardDescriptionClass}>{action.description}</p>
            </div>

            <div className={cn(featureCardInnerPanelClass, 'mt-5 p-4')}>
              <div className="bg-muted/60 flex size-10 items-center justify-center rounded-xl">
                <Icon className="text-foreground size-5" />
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

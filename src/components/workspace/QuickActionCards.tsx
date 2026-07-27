import type { LucideIcon } from 'lucide-react'
import {
  ClipboardCheckIcon,
  GitCompareArrowsIcon,
  UploadIcon,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
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
    description: 'Qualify bidders against requirements',
    icon: ClipboardCheckIcon,
    mode: 'rfp',
    openUpload: true,
  },
  {
    id: 'scope-creep',
    label: 'Check scope creep',
    description: 'Compare baseline vs change docs',
    icon: GitCompareArrowsIcon,
    mode: 'scope_creep',
    openUpload: true,
  },
  {
    id: 'upload-docs',
    label: 'Upload docs',
    description: 'Add files to this session, then analyse',
    icon: UploadIcon,
    openUpload: true,
  },
]

const FAN_STYLES = [
  'z-0 origin-bottom -rotate-6 translate-y-3 hover:-translate-y-0.5 hover:-rotate-3',
  'z-10 origin-bottom scale-[1.02] hover:-translate-y-1',
  'z-0 origin-bottom rotate-6 translate-y-3 hover:-translate-y-0.5 hover:rotate-3',
] as const

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
        'flex w-full max-w-2xl items-end justify-center gap-3 px-2 sm:gap-4',
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
            className={cn(
              'group/card-btn w-[9.5rem] transition-transform duration-200 ease-out sm:w-44',
              FAN_STYLES[index],
            )}
          >
            <Card
              size="sm"
              className="border-border bg-surface hover:shadow-elevated h-full cursor-pointer border shadow-panel transition-shadow"
            >
              <CardContent className="flex flex-col items-start gap-3 pt-1">
                <div className="bg-muted text-foreground flex size-9 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-sm">{action.label}</CardTitle>
                  <CardDescription className="mt-1 text-xs leading-snug">
                    {action.description}
                  </CardDescription>
                </div>
              </CardContent>
            </Card>
          </button>
        )
      })}
    </div>
  )
}

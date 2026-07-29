import {
  featureCardAccent,
  featureCardDescriptionClass,
  featureCardInnerPanelClass,
  featureCardShellClass,
  featureCardTitleClass,
} from '@/components/workspace/feature-card-styles'
import { Badge } from '@/components/ui/badge'
import { UPLOAD_SUGGESTIONS } from '@/lib/upload-suggestions'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

export function QuickActionCards({ className }: { className?: string }) {
  const setMode = useSessionStore((s) => s.setMode)
  const setUploadPopupOpen = useSessionStore((s) => s.setUploadPopupOpen)

  function openUpload() {
    setMode('rfp')
    setUploadPopupOpen(true)
  }

  return (
    <div
      className={cn(
        'grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3',
        className,
      )}
    >
      {UPLOAD_SUGGESTIONS.map((action, index) => {
        const disabled = action.disabled ?? false

        return (
          <button
            key={action.id}
            type="button"
            disabled={disabled}
            aria-disabled={disabled}
            onClick={() => {
              if (!disabled) openUpload()
            }}
            className={cn(
              'group text-left',
              featureCardShellClass,
              featureCardAccent(index),
              disabled
                ? 'cursor-not-allowed opacity-45 saturate-50 hover:translate-y-0'
                : 'cursor-pointer hover:-translate-y-0.5',
            )}
          >
            <div className="px-2 text-center">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <h3 className={featureCardTitleClass}>{action.label}</h3>
                {disabled ? (
                  <Badge variant="secondary" className="text-[10px] font-medium tracking-wide uppercase">
                    Coming soon
                  </Badge>
                ) : null}
              </div>
              <p className={featureCardDescriptionClass}>{action.description}</p>
            </div>

            <div aria-hidden className={cn(featureCardInnerPanelClass, 'mt-5 min-h-[14rem] p-4')} />
          </button>
        )
      })}
    </div>
  )
}

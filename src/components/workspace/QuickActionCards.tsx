import {
  featureCardAccent,
  featureCardDescriptionClass,
  featureCardInnerPanelClass,
  featureCardShellClass,
  featureCardTitleClass,
} from '@/components/workspace/feature-card-styles'
import { Badge } from '@/components/ui/badge'
import { UPLOAD_SUGGESTIONS, uploadIntentFromSuggestionId, workspaceModeForSuggestionId } from '@/lib/upload-suggestions'
import { SCOUT_TARGETS, scoutTargetProps } from '@/lib/scout/targets'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

export function QuickActionCards({ className }: { className?: string }) {
  const hasDocuments = useSessionStore((s) => s.documents.length > 0)
  const setMode = useSessionStore((s) => s.setMode)
  const setWorkspaceView = useSessionStore((s) => s.setWorkspaceView)
  const openUploadPopup = useSessionStore((s) => s.openUploadPopup)

  return (
    <div
      {...scoutTargetProps(SCOUT_TARGETS.quickActions)}
      className={cn(
        'grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3',
        className,
      )}
    >
      {UPLOAD_SUGGESTIONS.map((action, index) => {
        const disabled = action.disabled ?? false
        const intent = uploadIntentFromSuggestionId(action.id)
        const modeForAction = workspaceModeForSuggestionId(action.id)

        return (
          <button
            key={action.id}
            type="button"
            disabled={disabled}
            aria-disabled={disabled}
            onClick={() => {
              if (disabled || !intent) return
              if (modeForAction) {
                setMode(modeForAction)
              }
              if (hasDocuments && modeForAction === 'rfp') {
                setWorkspaceView('split')
                return
              }
              if (hasDocuments && modeForAction === 'proposal') {
                setWorkspaceView('profiles')
                return
              }
              openUploadPopup(intent)
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

            <div aria-hidden className={cn(featureCardInnerPanelClass, 'mt-5 min-h-[11rem] p-4')} />
          </button>
        )
      })}
    </div>
  )
}

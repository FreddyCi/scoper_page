import { reviewerInitialsFromName } from '@/lib/reviewer-profile'
import { cn } from '@/lib/utils'

type CommentAuthorAvatarProps = {
  initials: string
  className?: string
}

export function CommentAuthorAvatar({ initials, className }: CommentAuthorAvatarProps) {
  const label = initials.trim() || '?'

  return (
    <span
      aria-hidden
      className={cn(
        'bg-sky-100 text-sky-900 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tracking-wide',
        className,
      )}
    >
      {label.slice(0, 2).toUpperCase()}
    </span>
  )
}

type ReviewerIdentityFieldsProps = {
  reviewerName: string
  onReviewerNameChange: (name: string) => void
  className?: string
}

export function ReviewerIdentityFields({
  reviewerName,
  onReviewerNameChange,
  className,
}: ReviewerIdentityFieldsProps) {
  const initials = reviewerInitialsFromName(reviewerName)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <CommentAuthorAvatar initials={initials} />
      <div className="min-w-0 flex-1">
        <label htmlFor="reviewer-name" className="text-muted-foreground text-[10px] font-medium">
          Your name
        </label>
        <input
          id="reviewer-name"
          type="text"
          value={reviewerName}
          onChange={(event) => onReviewerNameChange(event.target.value)}
          placeholder="e.g. Chris Kruger"
          className="border-border bg-surface text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 mt-0.5 w-full rounded-md border px-2 py-1 text-xs outline-none focus-visible:ring-2"
        />
      </div>
      <span className="text-muted-foreground shrink-0 text-[10px] font-medium tabular-nums">
        {initials}
      </span>
    </div>
  )
}

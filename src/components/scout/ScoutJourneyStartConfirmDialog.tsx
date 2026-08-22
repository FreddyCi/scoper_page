import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { journeyStartConfirmCopy, readSessionGuardSnapshot } from '@/lib/scout/session-guard'
import type { ScoutJourneyId } from '@/lib/scout/types'

type ScoutJourneyStartConfirmDialogProps = {
  open: boolean
  journeyId: ScoutJourneyId | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/** Confirm clearing workspace before starting a Scout journey (BDA-289). */
export function ScoutJourneyStartConfirmDialog({
  open,
  journeyId,
  onOpenChange,
  onConfirm,
}: ScoutJourneyStartConfirmDialogProps) {
  if (!journeyId) {
    return null
  }

  const copy = journeyStartConfirmCopy(journeyId, readSessionGuardSnapshot())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="scout-journey-start-description">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription id="scout-journey-start-description">{copy.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm}>
            {copy.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

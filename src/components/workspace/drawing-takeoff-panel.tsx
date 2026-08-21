import { LayoutGridIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { DrawingTakeoffRow } from '@/lib/drawing-takeoff'

export type DrawingTakeoffPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: DrawingTakeoffRow[]
  documentFilename: string
  onRowActivate: (row: DrawingTakeoffRow) => void
}

function TakeoffRowButton({
  row,
  onActivate,
}: {
  row: DrawingTakeoffRow
  onActivate: () => void
}) {
  const countLabel = row.count === 1 ? '1 mark' : `${row.count} marks`

  return (
    <Button
      type="button"
      variant="ghost"
      className="border-border bg-surface hover:bg-muted/40 flex h-auto w-full items-start gap-2.5 justify-start rounded-xl border px-3 py-3 text-left shadow-sm"
      onClick={onActivate}
    >
      <span
        className="mt-0.5 size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: row.color }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-foreground text-sm font-semibold">{row.label}</span>
          <span className="text-muted-foreground text-xs">Page {row.page}</span>
          <span className="text-muted-foreground text-xs">{countLabel}</span>
        </span>
        {row.voiceNote ? (
          <span className="text-muted-foreground line-clamp-2 block text-xs leading-relaxed">
            {row.voiceNote}
          </span>
        ) : (
          <span className="text-subtle-foreground block text-xs italic">No voice notation</span>
        )}
      </span>
    </Button>
  )
}

export function DrawingTakeoffPanel({
  open,
  onOpenChange,
  rows,
  documentFilename,
  onRowActivate,
}: DrawingTakeoffPanelProps) {
  const totalStamps = rows.reduce((sum, row) => sum + row.count, 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md" showCloseButton>
        <SheetHeader className="border-border/70 border-b">
          <SheetTitle className="flex items-center gap-2">
            <LayoutGridIcon className="size-4" aria-hidden />
            Stamp takeoff
          </SheetTitle>
          <SheetDescription>
            {documentFilename} · {totalStamps} window mark{totalStamps === 1 ? '' : 's'} grouped
            into {rows.length} row{rows.length === 1 ? '' : 's'}. Click a row to jump to that mark
            on the plan.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {rows.length === 0 ? (
            <Card
              size="sm"
              className="border-border bg-muted/30 gap-0 rounded-xl border py-0 shadow-none"
            >
              <CardHeader className="px-3 py-3">
                <CardTitle className="text-sm font-semibold">No window marks yet</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Place window stamps on the drawing PDF to build a takeoff list here.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            rows.map((row) => (
              <TakeoffRowButton
                key={`${row.page}-${row.label}-${row.color}-${row.voiceNote}`}
                row={row}
                onActivate={() => onRowActivate(row)}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

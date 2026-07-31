import { CheckIcon, ChevronDownIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DocumentMeta } from '@/lib/types'
import { cn } from '@/lib/utils'

type DocumentPickerSelectProps = {
  id: string
  value: string | null
  onChange: (docId: string | null) => void
  placeholder: string
  items: DocumentMeta[]
  className?: string
  disabled?: boolean
}

/** Doc picker with truncated trigger label — avoids object-valued combobox JSON in the input */
export function DocumentPickerSelect({
  id,
  value,
  onChange,
  placeholder,
  items,
  className,
  disabled,
}: DocumentPickerSelectProps) {
  const selected = items.find((doc) => doc.doc_id === value)
  const triggerLabel = selected?.filename ?? placeholder

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'border-input bg-background h-9 w-full min-w-0 justify-between gap-2 px-3 font-normal shadow-xs',
              !value && 'text-muted-foreground',
              className,
            )}
            title={selected?.filename}
          >
            <span className="min-w-0 truncate text-left">{triggerLabel}</span>
            <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <DropdownMenuContent
        align="start"
        className="w-[var(--anchor-width)] max-w-[min(100vw-2rem,28rem)]"
      >
        <DropdownMenuItem
          className="text-muted-foreground"
          onClick={() => onChange(null)}
        >
          {placeholder}
        </DropdownMenuItem>
        {items.map((doc) => (
          <DropdownMenuItem
            key={doc.doc_id}
            className="gap-2 py-2"
            onClick={() => onChange(doc.doc_id)}
          >
            <CheckIcon
              className={cn(
                'size-4 shrink-0',
                value === doc.doc_id ? 'opacity-100' : 'opacity-0',
              )}
            />
            <span className="min-w-0 break-all leading-snug">{doc.filename}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

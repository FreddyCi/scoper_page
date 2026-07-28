import { useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  DOCUMENT_ROLE_DESCRIPTIONS,
  DOCUMENT_ROLE_LABELS,
  DOCUMENT_ROLES,
} from '@/lib/document-roles'
import type { DocumentRole } from '@/lib/types'
import { cn } from '@/lib/utils'
import { setDocumentRole } from '@/services/document-roles'

type DocumentRoleSelectorProps = {
  docId: string
  role: DocumentRole
  className?: string
}

const ROLE_VALUE_CLASS: Record<DocumentRole, string> = {
  baseline: 'text-foreground',
  change_request: 'text-foreground',
  supporting: 'text-foreground',
  unknown: 'text-muted-foreground',
}

/** Per-document role dropdown — baseline | change | supporting | unknown (BDA-070) */
export function DocumentRoleSelector({ docId, role, className }: DocumentRoleSelectorProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSelect(nextRole: DocumentRole) {
    if (nextRole === role || pending) {
      setOpen(false)
      return
    }

    setPending(true)
    try {
      await setDocumentRole(docId, nextRole)
      setOpen(false)
    } catch (error) {
      console.error('[document-role]', error)
    } finally {
      setPending(false)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={pending}
        className={cn('relative shrink-0', className)}
        render={
          <button
            type="button"
            aria-label={`Document role: ${DOCUMENT_ROLE_LABELS[role]}. Choose how this file is used in analysis.`}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            className="border-border/80 bg-muted/40 hover:bg-muted/70 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        }
      >
        <span className="text-muted-foreground tracking-wide uppercase">Role</span>
        <span className={cn('tracking-wide uppercase', ROLE_VALUE_CLASS[role])}>
          {DOCUMENT_ROLE_LABELS[role]}
        </span>
        <ChevronDownIcon className="text-muted-foreground size-3 shrink-0 opacity-70" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="min-w-[15rem]"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DropdownMenuLabel className="px-3 py-2 font-normal">
          <p className="text-foreground text-xs font-semibold">Document role</p>
          <p className="text-muted-foreground mt-0.5 text-[10px] leading-snug font-normal">
            Tags how this file is used in RFP qualification and scope creep analysis.
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={role} onValueChange={(value) => void handleSelect(value as DocumentRole)}>
          {DOCUMENT_ROLES.map((option) => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              disabled={pending}
              className="items-start py-1.5 pl-3"
            >
              <span className="text-xs font-medium">{DOCUMENT_ROLE_LABELS[option]}</span>
              <span className="text-muted-foreground mt-0.5 block text-[10px] leading-snug font-normal">
                {DOCUMENT_ROLE_DESCRIPTIONS[option]}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

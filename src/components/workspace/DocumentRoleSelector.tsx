import { useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MenuOptionContent, MenuOptionHeader } from '@/components/ui/menu-option-content'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
      <Tooltip disabled={open}>
        <TooltipTrigger
          delay={300}
          render={
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
          }
        />
        <TooltipContent side="bottom" align="start" className="max-w-[14rem] font-normal">
          {DOCUMENT_ROLE_DESCRIPTIONS[role]}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-72 p-0"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-0 py-0 font-normal">
            <MenuOptionHeader
              title="Document role"
              description="Tags how this file is used in RFP qualification and scope creep analysis."
            />
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={role}
          onValueChange={(value) => void handleSelect(value as DocumentRole)}
          className="p-1"
        >
          {DOCUMENT_ROLES.map((option) => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              disabled={pending}
              className="items-start rounded-md py-2.5 pr-9 pl-3 [&_[data-slot=dropdown-menu-radio-item-indicator]]:top-2.5"
            >
              <MenuOptionContent
                title={DOCUMENT_ROLE_LABELS[option]}
                description={DOCUMENT_ROLE_DESCRIPTIONS[option]}
              />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

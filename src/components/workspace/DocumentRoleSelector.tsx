import { useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'

import {
  BrandDropdownContent,
  BrandMenuSection,
  BrandMenuSectionHeader,
  brandMenuItemClass,
  brandRoleTriggerClass,
} from '@/components/ui/brand-menu'
import {
  DropdownMenu,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MenuOptionContent } from '@/components/ui/menu-option-content'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { brandAccentStyles, type BrandAccent } from '@/lib/brand-accent'
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

const ROLE_ACCENT: Record<DocumentRole, BrandAccent> = {
  baseline: 'sky',
  change_request: 'amber',
  supporting: 'violet',
  unknown: 'neutral',
}

/** Per-document role dropdown — baseline | change | supporting | unknown (BDA-070) */
export function DocumentRoleSelector({ docId, role, className }: DocumentRoleSelectorProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const activeAccent = ROLE_ACCENT[role]

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
                  className={brandRoleTriggerClass(activeAccent)}
                />
              }
            >
              <span
                className={cn(
                  'tracking-wide uppercase opacity-80',
                  brandAccentStyles(activeAccent).title,
                )}
              >
                Role
              </span>
              <span className={cn('tracking-wide uppercase', brandAccentStyles(activeAccent).title)}>
                {DOCUMENT_ROLE_LABELS[role]}
              </span>
              <ChevronDownIcon
                className={cn('size-3 shrink-0 opacity-70', brandAccentStyles(activeAccent).indicator)}
              />
            </DropdownMenuTrigger>
          }
        />
        <TooltipContent side="bottom" align="start" className="max-w-[14rem] font-normal">
          {DOCUMENT_ROLE_DESCRIPTIONS[role]}
        </TooltipContent>
      </Tooltip>

      <BrandDropdownContent
        align="start"
        sideOffset={8}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <BrandMenuSection accent="neutral">
          <BrandMenuSectionHeader
            accent="neutral"
            title="Document role"
            description="Tags how this file is used in RFP qualification and scope creep analysis."
          />
          <DropdownMenuRadioGroup
            value={role}
            onValueChange={(value) => void handleSelect(value as DocumentRole)}
            className="flex flex-col gap-1 p-1.5 pt-0"
          >
            {DOCUMENT_ROLES.map((option) => {
              const accent = ROLE_ACCENT[option]
              const styles = brandAccentStyles(accent)

              return (
                <DropdownMenuRadioItem
                  key={option}
                  value={option}
                  disabled={pending}
                  className={brandMenuItemClass(accent, role === option)}
                >
                  <MenuOptionContent
                    title={DOCUMENT_ROLE_LABELS[option]}
                    description={DOCUMENT_ROLE_DESCRIPTIONS[option]}
                    titleClassName={styles.title}
                  />
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </BrandMenuSection>
      </BrandDropdownContent>
    </DropdownMenu>
  )
}

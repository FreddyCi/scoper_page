import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { AnchoredMenuPortal } from '@/components/ui/anchored-menu'
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

function roleBadgeVariant(role: DocumentRole): 'default' | 'secondary' | 'outline' | 'ghost' {
  switch (role) {
    case 'baseline':
      return 'default'
    case 'change_request':
      return 'secondary'
    case 'supporting':
      return 'outline'
    default:
      return 'ghost'
  }
}

/** Per-document role badge + dropdown — baseline | change | supporting | unknown (BDA-070) */
export function DocumentRoleSelector({ docId, role, className }: DocumentRoleSelectorProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

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
    <div ref={rootRef} className={cn('relative shrink-0', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Document role: ${DOCUMENT_ROLE_LABELS[role]}. Choose how this file is used in analysis.`}
        disabled={pending}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
        className="border-border/70 bg-background/60 hover:bg-background inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          Role
        </span>
        <Badge variant={roleBadgeVariant(role)} className="h-5 px-1.5 text-[10px] uppercase">
          {DOCUMENT_ROLE_LABELS[role]}
        </Badge>
        <ChevronDownIcon className="text-muted-foreground size-3 opacity-70" />
      </button>

      {open ? (
        <AnchoredMenuPortal
          open={open}
          anchorRef={rootRef}
          role="listbox"
          aria-label="Select document role"
          className="min-w-[15rem]"
        >
          <div className="border-border/70 border-b px-3 py-2">
            <p className="text-foreground text-xs font-semibold">Document role</p>
            <p className="text-muted-foreground mt-0.5 text-[10px] leading-snug">
              Tags how this file is used in RFP qualification and scope creep analysis.
            </p>
          </div>
          {DOCUMENT_ROLES.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={role === option}
              disabled={pending}
              onClick={() => void handleSelect(option)}
              className={cn(
                'hover:bg-muted block w-full px-3 py-1.5 text-left transition-colors',
                role === option && 'bg-muted',
              )}
            >
              <span className="text-xs font-medium">{DOCUMENT_ROLE_LABELS[option]}</span>
              <span className="text-muted-foreground mt-0.5 block text-[10px] leading-snug">
                {DOCUMENT_ROLE_DESCRIPTIONS[option]}
              </span>
            </button>
          ))}
        </AnchoredMenuPortal>
      ) : null}
    </div>
  )
}

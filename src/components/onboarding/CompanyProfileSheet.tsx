import { useState } from 'react'
import { Building2Icon, XIcon } from 'lucide-react'

import { CompanyProfileSetupPrompt } from '@/components/onboarding/CompanyProfileSetupPrompt'
import { CompanyProfileSummary } from '@/components/onboarding/CompanyProfileSummary'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  BrandMenuSection,
  BrandMenuSectionHeader,
} from '@/components/ui/brand-menu'
import { overlayTitleClass } from '@/lib/overlay-chrome'
import { cn } from '@/lib/utils'
import {
  selectCompanyProfile,
  selectHasCompletedOnboarding,
  useCompanyProfileStore,
} from '@/store/company-profile-store'

function triggerLabel(legalName: string): string {
  const trimmed = legalName.trim()
  if (!trimmed) return 'Company profile'
  if (trimmed.length <= 22) return trimmed
  return `${trimmed.slice(0, 20).trimEnd()}…`
}

/** Footer drawer — persistent home for the saved company profile (BDA-308). */
export function CompanyProfileSheet() {
  const [open, setOpen] = useState(false)
  const profile = useCompanyProfileStore(selectCompanyProfile)
  const hasCompletedOnboarding = useCompanyProfileStore(selectHasCompletedOnboarding)

  return (
    <Drawer open={open} onOpenChange={setOpen} swipeDirection="right">
      <DrawerTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-subtle-foreground hover:text-foreground h-7 max-w-[11rem] rounded-full px-2.5 text-xs font-normal"
          >
            <Building2Icon className="size-3.5 shrink-0" />
            <span className="truncate">{triggerLabel(profile.legalName)}</span>
          </Button>
        }
      />

      <DrawerContent
        className={cn(
          'border-border bg-workspace text-foreground shadow-elevated',
          '[--drawer-inset:var(--spacing-shell)] [--drawer-bleed-background:var(--color-workspace)]',
          'data-[swipe-direction=right]:rounded-l-[1.75rem] data-[swipe-direction=right]:border-l',
          'data-[swipe-direction=right]:sm:[--drawer-content-width:26rem]',
        )}
      >
        <DrawerHeader className="relative gap-3 px-5 pt-5 pb-2">
          <DrawerClose
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-4 right-4 rounded-full"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DrawerClose>

          <div className="flex items-start gap-3 pr-10">
            <div className="border-sky-200/80 bg-surface shadow-panel flex size-11 shrink-0 items-center justify-center rounded-2xl border">
              <Building2Icon className="text-primary size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <DrawerTitle className={overlayTitleClass}>Company profile</DrawerTitle>
              <DrawerDescription className="text-muted-foreground text-xs leading-relaxed">
                Saved in this browser — Scout uses it to qualify bids and draft proposal responder
                context.
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {hasCompletedOnboarding ? (
            <BrandMenuSection accent="sky" className="p-1">
              <BrandMenuSectionHeader
                accent="sky"
                title="Your company"
                description="Edit the questionnaire anytime — freeform responder text stays editable in RFP and proposal panels."
              />
              <div className="px-3 pb-3">
                <CompanyProfileSummary variant="panel" />
              </div>
            </BrandMenuSection>
          ) : (
            <CompanyProfileSetupPrompt />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

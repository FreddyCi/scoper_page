import { useCallback, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BrandMenuSection, BrandMenuSectionHeader } from '@/components/ui/brand-menu'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from '@/components/ui/questionnaire'
import {
  companyProfileToFormDefaults,
  formDefaultIncludes,
  formDefaultString,
} from '@/lib/company-profile/form-defaults'
import {
  buildCompanyOnboardingQuestionnaireItems,
  COMPANY_ONBOARDING_ITEMS,
  type CompanyOnboardingItem,
} from '@/lib/company-profile/questionnaire-items'
import {
  parseCompanyProfileFromFormData,
  validateCompanyProfile,
  type CompanyProfile,
} from '@/lib/company-profile/schema'
import {
  demoCompanyProfile,
  isDemoCompanyProfile,
} from '@/lib/company-profile/demo-company-profile'
import {
  syncCompanyProfileToSessionContext,
} from '@/lib/company-profile/to-company-context'
import { SAMPLE_FIXTURE_COMPANY } from '@/lib/sample-fixture-company'
import { cn } from '@/lib/utils'
import {
  selectCompanyProfile,
  useCompanyProfileStore,
} from '@/store/company-profile-store'

type CompanyOnboardingQuestionnaireCoreProps = {
  className?: string
  onSubmitted?: (profile: CompanyProfile) => void
  showDemoCompanyToggle?: boolean
}

function DemoCompanyProfileToggle({
  enabled,
  disabled,
  onEnabledChange,
}: {
  enabled: boolean
  disabled?: boolean
  onEnabledChange: (enabled: boolean) => void
}) {
  return (
    <div className="border-border/70 bg-workspace/40 flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5">
      <div className="min-w-0">
        <Label
          htmlFor="demo-company-profile-toggle"
          className="text-foreground cursor-pointer text-sm font-medium"
        >
          Use demo company
        </Label>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
          Fills every answer with{' '}
          <span className="text-foreground font-medium">{SAMPLE_FIXTURE_COMPANY.legalName}</span> —
          fall-protection envelope sub for Scout tours.
        </p>
      </div>
      <Switch
        id="demo-company-profile-toggle"
        checked={enabled}
        disabled={disabled}
        className="shrink-0"
        aria-label="Use demo company profile"
        onCheckedChange={onEnabledChange}
      />
    </div>
  )
}

function isDifferentiatorPresetValue(value: string): boolean {
  return value.startsWith('preset:')
}

function renderOnboardingItem(
  item: CompanyOnboardingItem,
  defaults: ReturnType<typeof companyProfileToFormDefaults>,
  invalidItem: string | null,
  onItemStatusChange: (name: string, status: 'unanswered' | 'answered' | 'skipped') => void,
) {
  const invalid = invalidItem === item.name

  return (
    <QuestionnaireItem
      key={item.name}
      name={item.name}
      required={item.required}
      multiple={item.multiple}
      invalid={invalid}
      onStatusChange={(status) => onItemStatusChange(item.name, status)}
    >
      <QuestionnaireTitle>{item.prompt}</QuestionnaireTitle>
      <QuestionnaireDescription>{item.description}</QuestionnaireDescription>

      {item.choices && item.choices.length > 0 ? (
        <QuestionnaireChoices>
          {item.choices.map((choice) => (
            <QuestionnaireChoice
              key={choice.value}
              value={choice.value}
              defaultChecked={formDefaultIncludes(defaults, item.name, choice.value)}
            >
              <span className="font-medium">{choice.label}</span>
              {choice.description ? (
                <QuestionnaireChoiceDescription>{choice.description}</QuestionnaireChoiceDescription>
              ) : null}
            </QuestionnaireChoice>
          ))}
          {item.input ? (
            <QuestionnaireInput
              aria-label={item.input.label}
              placeholder={item.input.placeholder}
              defaultValue={
                item.name === 'differentiators' &&
                !isDifferentiatorPresetValue(formDefaultString(defaults, item.name) ?? '')
                  ? formDefaultString(defaults, item.name)
                  : undefined
              }
            />
          ) : null}
        </QuestionnaireChoices>
      ) : item.input ? (
        <QuestionnaireInput
          aria-label={item.input.label}
          placeholder={item.input.placeholder}
          defaultValue={formDefaultString(defaults, item.name)}
        />
      ) : null}

      <QuestionnaireError />
    </QuestionnaireItem>
  )
}

/** Shared company onboarding Questionnaire form (BDA-306). */
export function CompanyOnboardingQuestionnaireCore({
  className,
  onSubmitted,
  showDemoCompanyToggle = true,
}: CompanyOnboardingQuestionnaireCoreProps) {
  const storedProfile = useCompanyProfileStore(selectCompanyProfile)
  const onboardingStep = useCompanyProfileStore((state) => state.onboardingStep)
  const setOnboardingResumeState = useCompanyProfileStore((state) => state.setOnboardingResumeState)
  const markOnboardingComplete = useCompanyProfileStore((state) => state.markOnboardingComplete)

  const skippedItemsRef = useRef(new Set<string>())
  const formRef = useRef<HTMLFormElement>(null)

  const initialItem =
    onboardingStep && COMPANY_ONBOARDING_ITEMS.some((item) => item.name === onboardingStep)
      ? onboardingStep
      : 'legalName'

  const [activeItem, setActiveItem] = useState(initialItem)
  const [invalidItem, setInvalidItem] = useState<string | null>(null)
  const [useDemoCompany, setUseDemoCompany] = useState(() => isDemoCompanyProfile(storedProfile))
  const [formInstanceKey, setFormInstanceKey] = useState(0)
  const [draftProfile, setDraftProfile] = useState(storedProfile)

  const profileForDefaults = useDemoCompany ? demoCompanyProfile() : storedProfile
  const formDefaults = useMemo(
    () => companyProfileToFormDefaults(profileForDefaults),
    [profileForDefaults],
  )
  const questionnaireItems = useMemo(
    () => buildCompanyOnboardingQuestionnaireItems(draftProfile),
    [draftProfile],
  )

  const persistDraftFromForm = useCallback(
    (step: string) => {
      const form = formRef.current
      if (!form) return

      const partial = parseCompanyProfileFromFormData(new FormData(form), {
        skippedItems: [...skippedItemsRef.current],
      })

      setDraftProfile((previous) => ({ ...previous, ...partial }))
      setOnboardingResumeState({ onboardingStep: step, profile: partial })
    },
    [setOnboardingResumeState],
  )

  const handleItemChange = useCallback(
    (itemName: string) => {
      setActiveItem(itemName)
      setInvalidItem(null)
      persistDraftFromForm(itemName)
    },
    [persistDraftFromForm],
  )

  const handleItemStatusChange = useCallback(
    (name: string, status: 'unanswered' | 'answered' | 'skipped') => {
      if (status === 'skipped') {
        skippedItemsRef.current.add(name)
      } else {
        skippedItemsRef.current.delete(name)
      }
    },
    [],
  )

  const handleDemoCompanyToggle = useCallback(
    (enabled: boolean) => {
      setUseDemoCompany(enabled)
      setInvalidItem(null)
      skippedItemsRef.current.clear()

      const profile = enabled ? demoCompanyProfile() : storedProfile
      setDraftProfile(profile)
      setOnboardingResumeState({ onboardingStep: activeItem, profile })
      setFormInstanceKey((key) => key + 1)
    },
    [activeItem, setOnboardingResumeState, storedProfile],
  )

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const profile = parseCompanyProfileFromFormData(new FormData(event.currentTarget), {
        skippedItems: [...skippedItemsRef.current],
      })
      const validation = validateCompanyProfile(profile)

      if (!validation.ok) {
        if (validation.firstInvalidItem) {
          setActiveItem(validation.firstInvalidItem)
          setInvalidItem(validation.firstInvalidItem)
        }
        return
      }

      markOnboardingComplete(profile)
      syncCompanyProfileToSessionContext(profile)
      onSubmitted?.(profile)
    },
    [markOnboardingComplete, onSubmitted],
  )

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {showDemoCompanyToggle ? (
        <DemoCompanyProfileToggle
          enabled={useDemoCompany}
          onEnabledChange={handleDemoCompanyToggle}
        />
      ) : null}

      <Questionnaire
        ref={formRef}
        key={`${formInstanceKey}:${profileForDefaults.legalName}:${onboardingStep ?? 'new'}`}
        className="max-w-md"
        items={questionnaireItems}
        item={activeItem}
        shortcuts="letters"
        onItemChange={handleItemChange}
        onSubmit={handleSubmit}
      >
        <QuestionnaireProgress />

        {COMPANY_ONBOARDING_ITEMS.map((item) =>
          renderOnboardingItem(item, formDefaults, invalidItem, handleItemStatusChange),
        )}

        <QuestionnaireActions>
          <QuestionnairePrevious />
          <QuestionnaireSkip />
          <QuestionnaireNext />
          <QuestionnaireSubmit>Save company profile</QuestionnaireSubmit>
        </QuestionnaireActions>
      </Questionnaire>
    </div>
  )
}

type CompanyOnboardingQuestionnaireDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitted?: (profile: CompanyProfile) => void
}

/** First-visit dialog wrapper — host owns open state and cancel (BDA-306). */
export function CompanyOnboardingQuestionnaireDialog({
  open,
  onOpenChange,
  onSubmitted,
}: CompanyOnboardingQuestionnaireDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92svh,44rem)] overflow-y-auto sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Tell us about your company</DialogTitle>
          <DialogDescription>
            A short profile helps Scout qualify bids and draft proposals with your trade, certs, and
            differentiators — everything stays in this browser.
          </DialogDescription>
        </DialogHeader>
        <CompanyOnboardingQuestionnaireCore
          onSubmitted={(profile) => {
            onSubmitted?.(profile)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

type CompanyOnboardingQuestionnaireCardProps = {
  className?: string
  title?: string
  description?: string
  onSubmitted?: (profile: CompanyProfile) => void
  footer?: ReactNode
}

/** Inline card variant for proposal / evaluation setup panels (BDA-306). */
export function CompanyOnboardingQuestionnaireCard({
  className,
  title = 'Company profile',
  description = 'Complete this once — we reuse it for RFP qualification and proposal drafts.',
  onSubmitted,
  footer,
}: CompanyOnboardingQuestionnaireCardProps) {
  return (
    <Card className={cn('max-w-2xl', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <BrandMenuSection accent="sky" className="p-1">
          <BrandMenuSectionHeader
            accent="sky"
            title="Onboarding questionnaire"
            description="Use keyboard shortcuts on choices where shown"
          />
          <div className="px-3 pb-3">
            <CompanyOnboardingQuestionnaireCore onSubmitted={onSubmitted} />
          </div>
        </BrandMenuSection>
        {footer}
      </CardContent>
    </Card>
  )
}

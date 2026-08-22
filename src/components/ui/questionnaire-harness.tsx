import { act } from 'react'
import { createRoot } from 'react-dom/client'

import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnaireProgress,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from '@/components/ui/questionnaire'

const HARNESS_ITEMS = [
  {
    name: 'trade',
    required: true,
    prompt: 'What is your primary trade?',
    description: 'Pick the discipline that best matches your company.',
    choices: [
      { value: 'envelope', label: 'Building envelope' },
      { value: 'fall-protection', label: 'Fall protection' },
    ],
  },
] as const

/** Expected onboarding exports (BDA-303). */
export const QUESTIONNAIRE_ONBOARDING_EXPORTS = [
  'Questionnaire',
  'QuestionnaireActions',
  'QuestionnaireChoice',
  'QuestionnaireChoices',
  'QuestionnaireDescription',
  'QuestionnaireError',
  'QuestionnaireInput',
  'QuestionnaireItem',
  'QuestionnaireNext',
  'QuestionnairePrevious',
  'QuestionnaireProgress',
  'QuestionnaireSkip',
  'QuestionnaireSubmit',
  'QuestionnaireTitle',
] as const

function QuestionnaireHarnessDemo() {
  return (
    <Questionnaire items={HARNESS_ITEMS}>
      <QuestionnaireProgress />
      {HARNESS_ITEMS.map((question) => (
        <QuestionnaireItem key={question.name} name={question.name} required={question.required}>
          <QuestionnaireTitle>{question.prompt}</QuestionnaireTitle>
          <QuestionnaireDescription>{question.description}</QuestionnaireDescription>
          <QuestionnaireChoices>
            {question.choices.map((choice) => (
              <QuestionnaireChoice key={choice.value} value={choice.value}>
                <span className="font-medium">{choice.label}</span>
              </QuestionnaireChoice>
            ))}
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
      ))}
      <QuestionnaireActions>
        <QuestionnaireNext />
        <QuestionnaireSubmit />
      </QuestionnaireActions>
    </Questionnaire>
  )
}

/** Dev harness — smoke-render one-item Questionnaire (BDA-303). */
export function runQuestionnaireHarness(): void {
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  document.body.appendChild(container)

  try {
    const root = createRoot(container)
    act(() => {
      root.render(<QuestionnaireHarnessDemo />)
    })

    const progress = container.querySelector('[data-slot="questionnaire-progress"]')
    const next = container.querySelector('[data-slot="questionnaire-next"]')
    const submit = container.querySelector('[data-slot="questionnaire-submit"]')

    if (!progress?.textContent?.includes('Question 1 of 1')) {
      throw new Error('runQuestionnaireHarness: expected progress label')
    }
    if (!next) {
      throw new Error('runQuestionnaireHarness: expected Next control')
    }
    if (!submit) {
      throw new Error('runQuestionnaireHarness: expected Submit control')
    }

    act(() => {
      root.unmount()
    })
  } finally {
    container.remove()
  }
}

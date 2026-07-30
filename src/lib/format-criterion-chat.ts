import type { CriterionResult } from '@/lib/types'

export type FormatCriterionChatOptions = {
  contractFilename?: string
  docMention?: string
}

/** Plain-text block for clipboard or chat composer — explains a pass/warn/fail row */
export function formatCriterionChatPrompt(
  criterion: CriterionResult,
  options: FormatCriterionChatOptions = {},
): string {
  const statusLabel = criterion.status.toUpperCase()
  const lines = [
    `Why did this keyword check result as ${statusLabel}?`,
    '',
    `Checklist item: ${criterion.label}`,
  ]

  if (criterion.detail?.trim()) {
    lines.push(`Finding: ${criterion.detail.trim()}`)
  }

  if (criterion.citation?.excerpt) {
    const pageLabel =
      criterion.citation.page_num != null
        ? ` (page ${criterion.citation.page_num})`
        : ''
    lines.push('', `Contract excerpt${pageLabel}:`, `"${criterion.citation.excerpt.trim()}"`)
  }

  if (options.contractFilename) {
    lines.push('', `Contract: ${options.contractFilename}`)
  }

  if (options.docMention) {
    lines.push(`Context: @${options.docMention}`)
  }

  return lines.join('\n')
}

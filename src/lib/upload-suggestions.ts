export type UploadIntent = 'rfp' | 'context'

export const BIDDER_UPLOAD_PROMPT_KEY = 'scoper.bidder-upload-prompted'

export function promptBidderUploadOnce(openUploadPopup: (intent: UploadIntent) => void): void {
  if (sessionStorage.getItem(BIDDER_UPLOAD_PROMPT_KEY)) return
  sessionStorage.setItem(BIDDER_UPLOAD_PROMPT_KEY, '1')
  openUploadPopup('rfp')
}

export function clearBidderUploadPrompt(): void {
  sessionStorage.removeItem(BIDDER_UPLOAD_PROMPT_KEY)
}

export type UploadSuggestion = {
  id: string
  label: string
  description: string
  disabled?: boolean
}

export const UPLOAD_SUGGESTIONS: UploadSuggestion[] = [
  {
    id: 'analyse-rfp',
    label: 'Analyse RFP',
    description: 'Upload RFPs and bidder responses — PDF, Word, Excel, and more',
  },
  {
    id: 'scope-creep',
    label: 'Check Scope Creep',
    description: 'Compare baseline scope against change requests',
    disabled: true,
  },
  {
    id: 'upload-context',
    label: 'Upload Context',
    description: 'Add markdown notes and supporting context — not RFP documents',
  },
]

export type UploadIntentCopy = {
  title: string
  description: string
  dropTitle: string
  dropHint: string
  footerNote: string
  highlight: UploadSuggestion
  accept: string
}

export const UPLOAD_INTENT_COPY: Record<UploadIntent, UploadIntentCopy> = {
  rfp: {
    title: 'Upload RFP',
    description:
      'Add RFP packages and bidder responses for document review. Parsed locally in your browser — nothing is sent to a server.',
    dropTitle: 'Drop RFP files here or click to browse',
    dropHint: 'PDF, Word, and Excel — select one or more files before uploading',
    footerNote: 'RFP and bidder files open in document view for review and analysis.',
    highlight: UPLOAD_SUGGESTIONS[0]!,
    accept: '.pdf,.doc,.docx,.xls,.xlsx',
  },
  context: {
    title: 'Upload context',
    description:
      'Add markdown notes and supporting context for the agent. Parsed locally in your browser — nothing is sent to a server.',
    dropTitle: 'Drop markdown files here or click to browse',
    dropHint: '.md and .markdown — context is added to chat automatically',
    footerNote: 'Context uploads appear as tags in chat and stay attached until you remove them.',
    highlight: UPLOAD_SUGGESTIONS[2]!,
    accept: '.md,.markdown,text/markdown',
  },
}

export function uploadIntentFromSuggestionId(id: string): UploadIntent | null {
  if (id === 'upload-context') return 'context'
  if (id === 'analyse-rfp') return 'rfp'
  return null
}

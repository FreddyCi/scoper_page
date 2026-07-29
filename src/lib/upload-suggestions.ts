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
    label: 'Check scope creep',
    description: 'Compare baseline scope against change requests',
    disabled: true,
  },
  {
    id: 'upload-context',
    label: 'Upload context',
    description: 'Add markdown notes and supporting context — not RFP documents',
  },
]

export const UPLOAD_MODAL_DESCRIPTION =
  'Add RFP packages, bidder responses, or supporting context. Parsed locally in your browser — nothing is sent to a server.'

export const UPLOAD_MODAL_FOOTER_NOTE =
  'Markdown uploads are stored as supporting context. RFP and bidder files stay in document view.'

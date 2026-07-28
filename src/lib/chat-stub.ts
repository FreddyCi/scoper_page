import type {
  AssistantChatContent,
  ChatMessage,
  DocumentMeta,
  WorkspaceMode,
} from '@/lib/types'

type ReplyContext = {
  prompt: string
  mode: WorkspaceMode
  documents: DocumentMeta[]
  activeDocId: string | null
}

function activeDocumentLabel(documents: DocumentMeta[], activeDocId: string | null): string {
  const active = documents.find((doc) => doc.doc_id === activeDocId) ?? documents[0]
  if (!active) return 'This session'
  return active.filename.replace(/\.[^.]+$/, '')
}

export function buildRichAssistantReply(context: ReplyContext): AssistantChatContent {
  const subject = activeDocumentLabel(context.documents, context.activeDocId)
  const activeDoc = context.documents.find((doc) => doc.doc_id === context.activeDocId) ?? context.documents[0]

  if (context.mode === 'scope_creep') {
    return {
      headline: `${subject} needs attention`,
      paragraphs: [
        'I compared the baseline and change documents. Two deliverables drift outside the original scope, and one exclusion clause is missing from the addendum.',
        'The highlighted passage below is the strongest evidence for a possible creep flag.',
      ],
      citations: activeDoc
        ? [
            {
              id: crypto.randomUUID(),
              citation: {
                doc_id: activeDoc.doc_id,
                block_id: `${activeDoc.doc_id}:p2:i4`,
                page_num: 2,
                excerpt:
                  'Contractor shall provide additional analytics dashboards beyond the baseline reporting package.',
              },
              body: 'Section 2.4 — Change request excerpt:',
              highlight:
                'additional analytics dashboards beyond the baseline reporting package',
              sourceLabel: activeDoc.filename,
              sourceMeta: 'Page 2 · Scope addendum',
            },
          ]
        : [],
      actionsIntro: 'I prepared two actions you can review.',
      actions: [
        {
          id: crypto.randomUUID(),
          kind: 'draft',
          title: 'Draft scope creep summary',
          subtitle: 'Email draft · 2 evidence cites',
          status: 'pending',
        },
        {
          id: crypto.randomUUID(),
          kind: 'update',
          title: 'Update creep profile fields',
          subtitle: '4 field updates · AI enriched',
          status: 'pending',
        },
      ],
    }
  }

  if (/cmmi|certif|qualif|indemn/i.test(context.prompt)) {
    return {
      headline: `${subject} needs attention`,
      paragraphs: [
        'I found a hard qualification requirement in section 4.2.1. It reads as pass/fail rather than scored evaluation.',
        'Use the source card below to jump to the exact clause in the document viewer.',
      ],
      citations: activeDoc
        ? [
            {
              id: crypto.randomUUID(),
              citation: {
                doc_id: activeDoc.doc_id,
                block_id: `${activeDoc.doc_id}:p4:i2`,
                page_num: 4,
                excerpt:
                  'Offerors must maintain CMMI Level 3 or equivalent certification within 90 days of award.',
              },
              body: 'Section 4.2.1 — Qualification requirement:',
              highlight: 'CMMI Level 3 or equivalent certification within 90 days of award',
              sourceLabel: activeDoc.filename,
              sourceMeta: 'Page 4 · Evaluation criteria',
            },
          ]
        : [],
      actionsIntro: 'I prepared two actions you can review.',
      actions: [
        {
          id: crypto.randomUUID(),
          kind: 'analyze',
          title: 'Add CMMI criterion to profile',
          subtitle: 'Results profile · pass/fail rule',
          status: 'pending',
        },
        {
          id: crypto.randomUUID(),
          kind: 'update',
          title: 'Update bidder qualification fields',
          subtitle: '3 field updates · certification dates',
          status: 'pending',
        },
      ],
    }
  }

  return {
    headline: documentsHeadline(subject, context.documents.length),
    paragraphs: [
      'I found 12 evaluation criteria across sections 3.1–3.4. Three look like hard pass/fail requirements.',
      'Two bidder responses mention pricing tiers that may need a scored sub-criterion before you finalize the profile.',
    ],
    citationChips: activeDoc
      ? [
          {
            doc_id: activeDoc.doc_id,
            block_id: `${activeDoc.doc_id}:p4:i2`,
            page_num: 4,
            excerpt: 'CMMI Level 3 or equivalent certification within 90 days of award.',
          },
          {
            doc_id: activeDoc.doc_id,
            block_id: `${activeDoc.doc_id}:p3:i6`,
            page_num: 3,
            excerpt: 'Pricing for eight seats and higher monthly document limits.',
          },
        ]
      : [],
    citations: activeDoc
      ? [
          {
            id: crypto.randomUUID(),
            citation: {
              doc_id: activeDoc.doc_id,
              block_id: `${activeDoc.doc_id}:p3:i6`,
              page_num: 3,
              excerpt:
                'Can you confirm pricing for eight seats and describe higher monthly document limits?',
            },
            body: 'Section 3.2 — Pricing language:',
            highlight:
              'pricing for eight seats and describe higher monthly document limits',
            sourceLabel: activeDoc.filename,
            sourceMeta: 'Page 3 · Commercial terms',
          },
        ]
      : [],
    actionsIntro: 'I prepared two actions you can review.',
    actions: [
      {
        id: crypto.randomUUID(),
        kind: 'draft',
        title: 'Send qualification summary',
        subtitle: 'Email draft · top 3 criteria',
        status: 'pending',
      },
      {
        id: crypto.randomUUID(),
        kind: 'update',
        title: 'Update RFP profile fields',
        subtitle: '7 field updates · AI enriched',
        status: 'pending',
      },
    ],
  }
}

function documentsHeadline(subject: string, count: number): string {
  if (count === 0) return 'Ready when documents are uploaded'
  return `${subject} needs attention`
}

export function chatMessagePreview(message: ChatMessage): string {
  if (message.rich?.paragraphs.length) {
    return message.rich.paragraphs[0] ?? message.text
  }
  return message.text
}

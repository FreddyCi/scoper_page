import type {
  DocumentMeta,
  RfpResultsProfile,
  RfpVerdict,
} from '@/lib/types'

const VERDICTS: RfpVerdict[] = ['likely', 'might', 'unlikely']

/** Static mock profiles for UI harnesses (no DuckDB) */
export function buildMockRfpProfiles(documents: DocumentMeta[]): RfpResultsProfile[] {
  return documents.map((doc, index) => ({
    profile_id: `profile-${doc.doc_id}`,
    source_doc_id: doc.doc_id,
    verdict: VERDICTS[index % VERDICTS.length] ?? 'might',
    subject: {
      name: doc.filename.replace(/\.[^.]+$/, ''),
      role: index === 0 ? 'RFP source' : 'Bidder response',
      location: index === 0 ? 'City procurement portal' : `Bid package ${index}`,
    },
    criteria: [
      {
        id: `${doc.doc_id}-c1`,
        label: 'CMMI Level 3 certification',
        status: 'pass',
        detail: 'Required within 90 days of award',
        citation: {
          doc_id: doc.doc_id,
          block_id: `${doc.doc_id}:p4:i2`,
          page_num: 4,
          excerpt:
            'Offerors must maintain CMMI Level 3 or equivalent certification within 90 days of award.',
        },
      },
      {
        id: `${doc.doc_id}-c2`,
        label: 'Pricing tiers documented',
        status: 'warn',
        detail: 'Commercial terms in section 3.2',
        citation: {
          doc_id: doc.doc_id,
          block_id: `${doc.doc_id}:p3:i6`,
          page_num: 3,
          excerpt:
            'Can you confirm pricing for eight seats and describe higher monthly document limits?',
        },
      },
      {
        id: `${doc.doc_id}-c3`,
        label: 'Insurance minimums',
        status: 'fail',
        detail: 'General liability coverage',
      },
    ],
    summary:
      index === 0
        ? 'Source RFP defines hard pass/fail gates for certification and insurance.'
        : 'Bidder response meets most gates; pricing language may need clarification.',
  }))
}

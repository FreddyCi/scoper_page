import type { DocumentMeta, ScopeCreepProfile } from '@/lib/types'

/** Mock scope creep profiles until BDA-072 compare_scope pipeline lands */
export function buildMockCreepProfiles(documents: DocumentMeta[]): ScopeCreepProfile[] {
  const baseline = documents.find((doc) => doc.role === 'baseline')
  const change = documents.find((doc) => doc.role === 'change_request')

  if (!baseline || !change) {
    return []
  }

  return [
    {
      profile_id: `creep-${baseline.doc_id}-${change.doc_id}`,
      baseline_doc_id: baseline.doc_id,
      candidate_doc_id: change.doc_id,
      verdict: 'possible_creep',
      summary:
        'Two deliverables drift outside the baseline scope, and one exclusion clause is missing from the addendum.',
      flags: [
        {
          id: 'new-deliverable',
          flag_type: 'new_deliverable',
          severity: 'high',
          summary: 'Additional analytics dashboards beyond baseline reporting package',
          evidence: [
            {
              doc_id: change.doc_id,
              block_id: `${change.doc_id}:p2:i4`,
              page_num: 2,
              excerpt:
                'Contractor shall provide additional analytics dashboards beyond the baseline reporting package.',
            },
          ],
        },
        {
          id: 'missing-exclusion',
          flag_type: 'missing_clause',
          severity: 'medium',
          summary: 'Baseline exclusion for third-party integrations not carried forward',
          evidence: [
            {
              doc_id: baseline.doc_id,
              block_id: `${baseline.doc_id}:p3:i2`,
              page_num: 3,
              excerpt:
                'Vendor integrations with non-approved third-party systems are excluded from scope.',
            },
          ],
        },
        {
          id: 'timeline-shift',
          flag_type: 'timeline_gap',
          severity: 'low',
          summary: 'Delivery window compressed from 120 to 90 days without scope adjustment',
          evidence: [
            {
              doc_id: change.doc_id,
              block_id: `${change.doc_id}:p1:i1`,
              page_num: 1,
              excerpt: 'All deliverables shall be completed within ninety (90) calendar days.',
            },
          ],
        },
      ],
    },
  ]
}

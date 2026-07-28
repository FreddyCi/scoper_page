import { useEffect, useRef } from 'react'

import { buildRfpProfiles } from '@/services/build-rfp-profiles'
import { fetchDocumentBlocks } from '@/services/document-blocks'
import type { RfpResultsProfile } from '@/lib/types'
import { useSessionStore } from '@/store/session-store'

function profilesNeedCitationRelink(profiles: RfpResultsProfile[]): boolean {
  return profiles.some(
    (profile) =>
      profile.criteria.length > 0 && profile.criteria.every((criterion) => !criterion.citation),
  )
}

/** Rebuild profile citations once when older sessions have criteria without links. */
export function useRelinkRfpProfilesOnView(active: boolean) {
  const documents = useSessionStore((state) => state.documents)
  const profiles = useSessionStore((state) => state.profiles)
  const evaluationDocId = useSessionStore((state) => state.evaluationDocId)
  const companyContext = useSessionStore((state) => state.companyContext)
  const setProfiles = useSessionStore((state) => state.setProfiles)
  const setEvaluationBaselineProfile = useSessionStore((state) => state.setEvaluationBaselineProfile)
  const attemptedRef = useRef(false)

  useEffect(() => {
    if (!active || attemptedRef.current || documents.length === 0) return
    if (!profilesNeedCitationRelink(profiles)) return

    attemptedRef.current = true

    void (async () => {
      const blocks = await fetchDocumentBlocks(documents[0]!.doc_id)
      if (blocks.length === 0) return

      const rebuilt = await buildRfpProfiles(documents, { evaluationDocId, companyContext })
      setProfiles(rebuilt.responseProfiles)
      setEvaluationBaselineProfile(rebuilt.baselineProfile)
    })().catch((error) => {
      console.error('[rfp-profiles] citation relink failed', error)
    })
  }, [active, companyContext, documents, evaluationDocId, profiles, setEvaluationBaselineProfile, setProfiles])
}

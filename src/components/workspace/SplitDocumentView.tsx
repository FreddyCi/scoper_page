import { useEffect, useMemo, useState } from 'react'

import { DocumentViewer } from '@/components/workspace/DocumentViewer'
import { ExtractedTextPane } from '@/components/workspace/ExtractedTextPane'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentBlocks } from '@/hooks/use-document-blocks'
import { useSplitPaneRatio } from '@/hooks/use-split-pane-ratio'
import { buildRfpProfiles } from '@/services/build-rfp-profiles'
import { compareScope } from '@/services/compare-scope'
import type { DocumentMeta, WorkspaceMode } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/session-store'

type SplitPaneTab = 'extract' | 'original' | 'profiles'

type SplitDocumentViewProps = {
  document: DocumentMeta
  initialPage?: number
  className?: string
}

const MODE_CTA: Record<WorkspaceMode, string> = {
  rfp: 'Qualify document',
  scope_creep: 'Compare scope',
}

function SplitDocumentViewFooter({
  statusLabel,
  ctaLabel,
  ctaLoading = false,
  ctaLoadingLabel,
  onCtaClick,
}: {
  statusLabel: string
  ctaLabel: string
  ctaLoading?: boolean
  ctaLoadingLabel?: string
  onCtaClick: () => void
}) {
  return (
    <footer className="border-border bg-surface flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3">
      <span className="bg-muted text-muted-foreground rounded-pill inline-flex items-center px-3 py-1 text-xs font-medium">
        {statusLabel}
      </span>
      <Button type="button" size="sm" variant="default" onClick={onCtaClick} disabled={ctaLoading}>
        {ctaLoading ? (ctaLoadingLabel ?? 'Working…') : ctaLabel}
      </Button>
    </footer>
  )
}

export function SplitDocumentView({
  document,
  initialPage = 1,
  className,
}: SplitDocumentViewProps) {
  const [activeTab, setActiveTab] = useState<SplitPaneTab>('extract')
  const [buildingProfiles, setBuildingProfiles] = useState(false)
  const [comparingScope, setComparingScope] = useState(false)
  const { ratio, containerRef, onResizeStart } = useSplitPaneRatio(0.44)
  const mode = useSessionStore((state) => state.mode)
  const documents = useSessionStore((state) => state.documents)
  const setProfiles = useSessionStore((state) => state.setProfiles)
  const selectedCitation = useSessionStore((state) => state.selectedCitation)
  const citationFocusSeq = useSessionStore((state) => state.citationFocusSeq)
  const setWorkspaceView = useSessionStore((state) => state.setWorkspaceView)
  const { blocks, loading: blocksLoading } = useDocumentBlocks(document.doc_id)

  useEffect(() => {
    if (selectedCitation?.doc_id === document.doc_id) {
      setActiveTab('extract')
    }
  }, [selectedCitation?.block_id, citationFocusSeq, document.doc_id, selectedCitation?.doc_id])

  const statusLabel = useMemo(() => {
    if (blocksLoading) return 'Loading extracted blocks…'

    const blockCountLabel = `${blocks.length} block${blocks.length === 1 ? '' : 's'}`

    if (
      selectedCitation?.doc_id === document.doc_id &&
      selectedCitation.page_num != null
    ) {
      return `${blockCountLabel} · Page ${selectedCitation.page_num} selected`
    }

    return `${blockCountLabel} · ${document.filename}`
  }, [blocks.length, blocksLoading, document.doc_id, document.filename, selectedCitation])

  function handleCtaClick() {
    if (mode === 'scope_creep') {
      const baseline = documents.find((doc) => doc.role === 'baseline')
      const change = documents.find((doc) => doc.role === 'change_request')

      if (!baseline || !change) {
        console.warn('[split-document-view] scope compare requires baseline + change_request roles')
        return
      }

      setComparingScope(true)
      void compareScope({
        baselineDocId: baseline.doc_id,
        candidateDocId: change.doc_id,
      })
        .then(() => {
          setWorkspaceView('profiles')
        })
        .catch((error) => {
          console.error('[split-document-view] compareScope failed', error)
        })
        .finally(() => {
          setComparingScope(false)
        })
      return
    }

    setBuildingProfiles(true)
    void buildRfpProfiles(documents)
      .then((profiles) => {
        setProfiles(profiles)
        setWorkspaceView('profiles')
      })
      .catch((error) => {
        console.error('[split-document-view] buildRfpProfiles failed', error)
      })
      .finally(() => {
        setBuildingProfiles(false)
      })
  }

  return (
    <div
      className={cn(
        'border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border shadow-panel',
        className,
      )}
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as SplitPaneTab)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="border-border/70 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5">
          <TabsList variant="segmented">
            <TabsTrigger value="extract">Extract</TabsTrigger>
            <TabsTrigger value="original">Original</TabsTrigger>
            <TabsTrigger value="profiles">Profiles</TabsTrigger>
          </TabsList>

          <p className="text-muted-foreground hidden truncate text-xs sm:block">
            {document.filename}
          </p>
        </div>

        <TabsContent value="extract" className="mt-0 flex min-h-0 flex-1 flex-col">
          <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">
            <div
              className="bg-surface min-h-0 min-w-[16rem] overflow-hidden"
              style={{ width: `${ratio * 100}%` }}
            >
              <ExtractedTextPane docId={document.doc_id} className="h-full border-0 shadow-none" />
            </div>

            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panes"
              onPointerDown={onResizeStart}
              className="bg-border hover:bg-muted-foreground/30 w-1 shrink-0 cursor-col-resize transition-colors"
            />

            <div className="min-h-0 min-w-[16rem] flex-1 overflow-hidden">
              <DocumentViewer
                document={document}
                initialPage={initialPage}
                theme="dark"
                className="h-full rounded-none border-0"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="original" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <DocumentViewer
            document={document}
            initialPage={initialPage}
            theme="dark"
            className="h-full min-h-[20rem] rounded-none border-0"
          />
        </TabsContent>

        <TabsContent
          value="profiles"
          className="text-muted-foreground mt-0 flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center text-sm"
        >
          <p>Results profiles grid lives in the main profiles view — BDA-041.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setWorkspaceView('profiles')}>
            Open profiles
          </Button>
        </TabsContent>
      </Tabs>

      <SplitDocumentViewFooter
        statusLabel={statusLabel}
        ctaLabel={MODE_CTA[mode]}
        ctaLoading={buildingProfiles || comparingScope}
        ctaLoadingLabel={comparingScope ? 'Comparing…' : 'Qualifying…'}
        onCtaClick={handleCtaClick}
      />
    </div>
  )
}

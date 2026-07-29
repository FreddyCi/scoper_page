import { useEffect, useState, type ReactNode } from 'react'

import { clearShareLinkHash, readShareLinkFromLocation } from '@/services/share-pack-link'
import { importSharePackFromLink } from '@/services/share-pack-import'

type SharePackBootstrapProps = {
  children: ReactNode
}

/**
 * On load, consume `#share={id},{key}` links — fetch encrypted pack and hydrate DuckDB.
 */
export function SharePackBootstrap({ children }: SharePackBootstrapProps) {
  const [importState, setImportState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const link = readShareLinkFromLocation()
    if (!link) return

    let cancelled = false

    void (async () => {
      setImportState('loading')
      try {
        const payload = await importSharePackFromLink(link.shareId, link.keyBase64Url)
        if (cancelled) return
        clearShareLinkHash()
        setImportState('done')
        setMessage(
          `Loaded shared workspace (${payload.documents.length} documents).`,
        )
      } catch (error) {
        if (cancelled) return
        setImportState('error')
        setMessage(error instanceof Error ? error.message : 'Share import failed')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      {importState === 'loading' ? (
        <div className="bg-canvas/95 fixed inset-0 z-[100] flex items-center justify-center text-sm">
          Loading shared workspace…
        </div>
      ) : null}
      {message && importState !== 'loading' ? (
        <div className="bg-surface border-border fixed top-4 right-4 z-[100] max-w-sm rounded-md border px-3 py-2 text-xs shadow-md">
          {message}
        </div>
      ) : null}
      {children}
    </>
  )
}

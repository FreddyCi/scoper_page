export const SCOPER_MODEL_CACHE = 'scoper-model-v1'

async function fetchCached(url: string): Promise<Response> {
  const response =
    typeof caches === 'undefined'
      ? await fetch(url)
      : await (async () => {
          const cache = await caches.open(SCOPER_MODEL_CACHE)
          const hit = await cache.match(url)
          if (hit) return hit
          const fresh = await fetch(url)
          if (fresh.ok) {
            void cache.put(url, fresh.clone())
          }
          return fresh
        })()

  if (!response.ok) {
    throw new Error(`Scoper cache fetch failed: ${url} (${response.status})`)
  }

  return response
}

export async function fetchJsonCached(url: string): Promise<unknown> {
  return fetchCached(url).then((response) => response.json())
}

export async function fetchArrayBufferCached(url: string): Promise<ArrayBuffer> {
  return fetchCached(url).then((response) => response.arrayBuffer())
}

export async function isScoperAssetCached(url: string): Promise<boolean> {
  if (typeof caches === 'undefined') return false
  const cache = await caches.open(SCOPER_MODEL_CACHE)
  return Boolean(await cache.match(url))
}

export async function getScoperModelCacheStatus(): Promise<{
  manifestCached: boolean
  weightsCached: boolean
}> {
  const { SCOPER_BONSAI_17B } = await import('@/lib/scoper-model')
  const [manifestCached, weightsCached] = await Promise.all([
    isScoperAssetCached(SCOPER_BONSAI_17B.manifestUrl),
    isScoperAssetCached(SCOPER_BONSAI_17B.dataUrl),
  ])
  return { manifestCached, weightsCached }
}

const DB_NAME = 'scoper-share-packs'
const DB_VERSION = 1
const STORE_NAME = 'packs'

type SharePackRecord = {
  shareId: string
  bytes: Uint8Array
  createdAt: string
}

function openSharePackDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open share pack database'))
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'shareId' })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

export async function putLocalSharePack(shareId: string, bytes: Uint8Array): Promise<void> {
  const db = await openSharePackDb()

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const record: SharePackRecord = {
      shareId,
      bytes,
      createdAt: new Date().toISOString(),
    }
    const request = store.put(record)

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to store share pack'))
    }

    transaction.oncomplete = () => {
      db.close()
      resolve()
    }

    transaction.onerror = () => {
      reject(transaction.error ?? new Error('Share pack transaction failed'))
    }
  })
}

export async function getLocalSharePack(shareId: string): Promise<Uint8Array | null> {
  const db = await openSharePackDb()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(shareId)

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to read share pack'))
    }

    request.onsuccess = () => {
      const record = request.result as SharePackRecord | undefined
      resolve(record?.bytes ?? null)
    }

    transaction.oncomplete = () => {
      db.close()
    }
  })
}

export async function deleteLocalSharePack(shareId: string): Promise<void> {
  const db = await openSharePackDb()

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(shareId)

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to delete share pack'))
    }

    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
  })
}

export function createShareId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

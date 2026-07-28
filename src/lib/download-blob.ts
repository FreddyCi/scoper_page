/** Trigger a file download from a Blob — anchor must be attached to the document. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()

  window.setTimeout(() => {
    anchor.remove()
    URL.revokeObjectURL(url)
  }, 2_000)
}

type SaveBlobOptions = {
  filename: string
  mime: string
  extension: string
}

type SavePickerWindow = Window &
  typeof globalThis & {
    showSaveFilePicker?: (options: {
      suggestedName?: string
      types?: Array<{
        description?: string
        accept: Record<string, string[]>
      }>
    }) => Promise<FileSystemFileHandle>
  }

function canUseSaveFilePicker(): boolean {
  return typeof (window as SavePickerWindow).showSaveFilePicker === 'function'
}

function getSaveFilePicker(): NonNullable<SavePickerWindow['showSaveFilePicker']> {
  const picker = (window as SavePickerWindow).showSaveFilePicker
  if (!picker) {
    throw new Error('showSaveFilePicker is unavailable')
  }
  return picker
}

/**
 * Save a blob using the native file picker when available (preserves the user
 * gesture on Safari), otherwise fall back to a programmatic download.
 */
export async function saveBlobWithPicker(
  blob: Blob,
  { filename, mime, extension }: SaveBlobOptions,
): Promise<void> {
  if (canUseSaveFilePicker()) {
    try {
      const handle = await getSaveFilePicker()({
        suggestedName: filename,
        types: [
          {
            description: filename,
            accept: { [mime]: [extension] },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.warn('[download-blob] showSaveFilePicker failed, falling back to download link', error)
    }
  }

  downloadBlob(blob, filename)
}

/** Open the save picker during the click gesture, then write bytes when ready. */
export async function beginBlobSave({
  filename,
  mime,
  extension,
}: SaveBlobOptions): Promise<(blob: Blob) => Promise<void>> {
  if (canUseSaveFilePicker()) {
    try {
      const handle = await getSaveFilePicker()({
        suggestedName: filename,
        types: [
          {
            description: filename,
            accept: { [mime]: [extension] },
          },
        ],
      })

      return async (blob: Blob) => {
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      console.warn('[download-blob] showSaveFilePicker failed, falling back to download link', error)
    }
  }

  return async (blob: Blob) => {
    downloadBlob(blob, filename)
  }
}

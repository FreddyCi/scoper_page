/**
 * tesseract.js ships as CommonJS (`export =`). Vite must pre-bundle it; import
 * through this module so callers get stable ESM bindings in dev and prod.
 */
import * as TesseractModule from 'tesseract.js'

type TesseractApi = typeof import('tesseract.js')

function tesseract(): TesseractApi {
  const mod = TesseractModule as TesseractApi & { default?: TesseractApi }
  return mod.default ?? mod
}

export const createWorker: TesseractApi['createWorker'] = (...args) =>
  tesseract().createWorker(...args)

export type TesseractWorker = Awaited<ReturnType<TesseractApi['createWorker']>>

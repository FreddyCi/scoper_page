export type OcrRecognitionResult = {
  text: string
  bbox: [number, number, number, number]
  confidence: number
}

export type OcrWorkerRequest =
  | { type: 'init' }
  | { type: 'ping' }
  | {
      type: 'recognize'
      imageData: Uint8Array
      width: number
      height: number
      language: string
    }

export type OcrWorkerSuccess = {
  ok: true
  result?: unknown
}

export type OcrWorkerFailure = {
  ok: false
  error: string
}

export type OcrWorkerResponse = (OcrWorkerSuccess | OcrWorkerFailure) & {
  id: string
}

export type OcrWorkerMessage = { id: string } & OcrWorkerRequest

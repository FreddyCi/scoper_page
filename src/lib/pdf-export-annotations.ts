import {
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFString,
  type PDFDocument,
  type PDFPage,
} from 'pdf-lib'

import { toPdfLatinText } from '@/lib/pdf-latin-text'
import type { Bbox } from '@/lib/types'

type PdfRect = {
  x: number
  y: number
  width: number
  height: number
}

const HIGHLIGHT_COLOR: [number, number, number] = [0.98, 0.75, 0.14]

function makePdfRect(
  context: PDFDocument['context'],
  x: number,
  y: number,
  width: number,
  height: number,
): PDFArray {
  const rect = PDFArray.withContext(context)
  rect.push(PDFNumber.of(x))
  rect.push(PDFNumber.of(y))
  rect.push(PDFNumber.of(x + width))
  rect.push(PDFNumber.of(y + height))
  return rect
}

function makeQuadPoints(context: PDFDocument['context'], rects: PdfRect[]): PDFArray {
  const points = PDFArray.withContext(context)

  for (const rect of rects) {
    const left = rect.x
    const bottom = rect.y
    const right = rect.x + rect.width
    const top = rect.y + rect.height

    points.push(PDFNumber.of(left))
    points.push(PDFNumber.of(top))
    points.push(PDFNumber.of(right))
    points.push(PDFNumber.of(top))
    points.push(PDFNumber.of(left))
    points.push(PDFNumber.of(bottom))
    points.push(PDFNumber.of(right))
    points.push(PDFNumber.of(bottom))
  }

  return points
}

function makeColorArray(
  context: PDFDocument['context'],
  color: [number, number, number],
): PDFArray {
  const arr = PDFArray.withContext(context)
  arr.push(PDFNumber.of(color[0]))
  arr.push(PDFNumber.of(color[1]))
  arr.push(PDFNumber.of(color[2]))
  return arr
}

function registerAnnotation(page: PDFPage, dict: PDFDict): void {
  const annotRef = page.doc.context.register(dict)
  page.node.addAnnot(annotRef)
}

/** Native PDF highlight — can be shown/hidden via the viewer markup panel. */
export function addHighlightAnnotation(
  pdfDoc: PDFDocument,
  page: PDFPage,
  bbox: Bbox,
  contents: string,
): void {
  const context = pdfDoc.context
  const dict = PDFDict.withContext(context)
  const safeContents = toPdfLatinText(contents)

  dict.set(PDFName.of('Type'), PDFName.of('Annot'))
  dict.set(PDFName.of('Subtype'), PDFName.of('Highlight'))
  dict.set(PDFName.of('F'), PDFNumber.of(4))
  dict.set(PDFName.of('Rect'), makePdfRect(context, bbox.x, bbox.y, bbox.width, bbox.height))
  dict.set(PDFName.of('QuadPoints'), makeQuadPoints(context, [bbox]))
  dict.set(PDFName.of('C'), makeColorArray(context, HIGHLIGHT_COLOR))

  if (safeContents) {
    dict.set(PDFName.of('Contents'), PDFHexString.fromText(safeContents))
  }

  dict.set(PDFName.of('T'), PDFString.of('Scoper'))
  registerAnnotation(page, dict)
}

/** Native sticky-note annotation — hover/click in Preview or Acrobat; hide via markup. */
export function addTextNoteAnnotation(
  pdfDoc: PDFDocument,
  page: PDFPage,
  x: number,
  y: number,
  contents: string,
  options: { title?: string; color?: [number, number, number] } = {},
): void {
  const context = pdfDoc.context
  const textDict = PDFDict.withContext(context)
  const popupDict = PDFDict.withContext(context)
  const safeContents = toPdfLatinText(contents)
  const iconSize = 18
  const popupWidth = 168
  const popupHeight = 72
  const title = options.title ?? 'Scoper'
  const color = options.color ?? HIGHLIGHT_COLOR

  textDict.set(PDFName.of('Type'), PDFName.of('Annot'))
  textDict.set(PDFName.of('Subtype'), PDFName.of('Text'))
  textDict.set(PDFName.of('F'), PDFNumber.of(4))
  textDict.set(PDFName.of('Rect'), makePdfRect(context, x, y - iconSize, iconSize, iconSize))
  textDict.set(PDFName.of('C'), makeColorArray(context, color))
  textDict.set(PDFName.of('Name'), PDFName.of('Comment'))
  textDict.set(PDFName.of('Open'), context.obj(false))
  textDict.set(PDFName.of('T'), PDFString.of(title))
  if (safeContents) {
    textDict.set(PDFName.of('Contents'), PDFHexString.fromText(safeContents))
  }
  if (title === 'Notation') {
    textDict.set(PDFName.of('Subj'), PDFString.of('Voice notation'))
  }

  const popupX = x + iconSize + 4
  const popupY = y - popupHeight
  popupDict.set(PDFName.of('Type'), PDFName.of('Annot'))
  popupDict.set(PDFName.of('Subtype'), PDFName.of('Popup'))
  popupDict.set(PDFName.of('F'), PDFNumber.of(4))
  popupDict.set(PDFName.of('Rect'), makePdfRect(context, popupX, popupY, popupWidth, popupHeight))
  popupDict.set(PDFName.of('Open'), context.obj(false))

  const textRef = context.register(textDict)
  const popupRef = context.register(popupDict)
  textDict.set(PDFName.of('Popup'), popupRef)
  popupDict.set(PDFName.of('Parent'), textRef)

  page.node.addAnnot(textRef)
  page.node.addAnnot(popupRef)
}

/** Native square annotation — toggleable outline; hover/click shows Contents. */
export function addSquareAnnotation(
  pdfDoc: PDFDocument,
  page: PDFPage,
  bbox: Bbox,
  contents: string,
  color: [number, number, number] = HIGHLIGHT_COLOR,
): void {
  const context = pdfDoc.context
  const dict = PDFDict.withContext(context)
  const popupDict = PDFDict.withContext(context)
  const safeContents = toPdfLatinText(contents)
  const border = PDFArray.withContext(context)
  border.push(PDFNumber.of(0))
  border.push(PDFNumber.of(0))
  border.push(PDFNumber.of(1.5))

  dict.set(PDFName.of('Type'), PDFName.of('Annot'))
  dict.set(PDFName.of('Subtype'), PDFName.of('Square'))
  dict.set(PDFName.of('F'), PDFNumber.of(4))
  dict.set(PDFName.of('Rect'), makePdfRect(context, bbox.x, bbox.y, bbox.width, bbox.height))
  dict.set(PDFName.of('C'), makeColorArray(context, color))
  dict.set(PDFName.of('Border'), border)
  dict.set(PDFName.of('T'), PDFString.of(safeContents ? 'Notation' : 'Scoper'))

  if (safeContents) {
    dict.set(PDFName.of('Contents'), PDFHexString.fromText(safeContents))
  }

  const popupWidth = 168
  const popupHeight = 72
  popupDict.set(PDFName.of('Type'), PDFName.of('Annot'))
  popupDict.set(PDFName.of('Subtype'), PDFName.of('Popup'))
  popupDict.set(PDFName.of('F'), PDFNumber.of(4))
  popupDict.set(
    PDFName.of('Rect'),
    makePdfRect(context, bbox.x + bbox.width + 4, bbox.y + bbox.height - popupHeight, popupWidth, popupHeight),
  )
  popupDict.set(PDFName.of('Open'), context.obj(false))

  const squareRef = context.register(dict)
  const popupRef = context.register(popupDict)
  dict.set(PDFName.of('Popup'), popupRef)
  popupDict.set(PDFName.of('Parent'), squareRef)

  page.node.addAnnot(squareRef)
  page.node.addAnnot(popupRef)
}

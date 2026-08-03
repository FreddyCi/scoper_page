import type { PdfMarkSessionTool } from '@/lib/types'

/** Single-key shortcuts when Mark mode is active (no modifiers). */
export const PDF_MARKUP_TOOL_BY_KEY: Readonly<Record<string, PdfMarkSessionTool>> = {
  h: 'hand',
  v: 'select',
  p: 'pen',
  l: 'highlighter',
  e: 'eraser',
  r: 'rect',
  c: 'ellipse',
  t: 'text',
  w: 'stamp',
}

export const PDF_MARKUP_TOOL_SHORTCUT_LABEL: Readonly<Partial<Record<PdfMarkSessionTool, string>>> =
  {
    hand: 'H',
    select: 'V',
    pen: 'P',
    highlighter: 'L',
    eraser: 'E',
    rect: 'R',
    ellipse: 'C',
    text: 'T',
    stamp: 'W',
  }

export function pdfMarkupToolForKey(key: string): PdfMarkSessionTool | null {
  if (key.length !== 1) return null
  return PDF_MARKUP_TOOL_BY_KEY[key.toLowerCase()] ?? null
}

export function isPdfMarkupShortcutTarget(element: EventTarget | null): boolean {
  if (!(element instanceof HTMLElement)) return false
  if (element.isContentEditable) return true
  const tag = element.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

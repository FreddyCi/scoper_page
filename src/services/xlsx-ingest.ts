import * as XLSX from 'xlsx'

import type { BlockRecord } from '@/lib/types'
import {
  cellDisplayText,
  readSpreadsheetWorkbook,
  readSpreadsheetWorkbookFromCsv,
} from '@/lib/spreadsheet-workbook'

function rowRangeLabel(range: XLSX.Range, row: number): string {
  const startCol = XLSX.utils.encode_col(range.s.c)
  const endCol = XLSX.utils.encode_col(range.e.c)
  const rowNumber = row + 1
  if (startCol === endCol) {
    return `${startCol}${rowNumber}`
  }
  return `${startCol}${rowNumber}:${endCol}${rowNumber}`
}

/** SheetJS workbook → row blocks with sheet + cell-range section_path (BDA-081) */
export function workbookToBlocks(docId: string, workbook: XLSX.WorkBook): BlockRecord[] {
  const blocks: BlockRecord[] = []

  for (const [sheetIndex, sheetName] of workbook.SheetNames.entries()) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet?.['!ref']) continue

    const range = XLSX.utils.decode_range(sheet['!ref'])

    for (let row = range.s.r; row <= range.e.r; row += 1) {
      const cells: string[] = []
      let hasContent = false

      for (let col = range.s.c; col <= range.e.c; col += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col })
        const value = cellDisplayText(sheet[address])
        if (value) hasContent = true
        cells.push(value)
      }

      if (!hasContent) continue

      const text = cells.filter(Boolean).join(' | ')
      if (!text) continue

      blocks.push({
        block_id: `${docId}:xlsx-${sheetIndex}-${row}`,
        doc_id: docId,
        page_num: sheetIndex + 1,
        section_path: `${sheetName} › ${rowRangeLabel(range, row)}`,
        text,
      })
    }
  }

  if (blocks.length === 0) {
    throw new Error('Spreadsheet contains no extractable cells')
  }

  return blocks
}

export function parseXlsxToBlocks(docId: string, bytes: ArrayBuffer): BlockRecord[] {
  return workbookToBlocks(docId, readSpreadsheetWorkbook(bytes))
}

export function parseCsvToBlocks(docId: string, bytes: ArrayBuffer): BlockRecord[] {
  return workbookToBlocks(docId, readSpreadsheetWorkbookFromCsv(bytes))
}

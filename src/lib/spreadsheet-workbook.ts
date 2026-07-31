import * as XLSX from 'xlsx'

export type SheetGrid = {
  sheetName: string
  rows: string[][]
  rowOffset: number
  colOffset: number
}

export function cellDisplayText(cell: XLSX.CellObject | undefined): string {
  if (!cell) return ''
  const formatted = cell.w?.trim()
  if (formatted) return formatted
  if (cell.v == null) return ''
  return String(cell.v).trim()
}

/** Parse .xlsx, .xls, .ods, and other formats SheetJS supports in the browser. */
export function readSpreadsheetWorkbook(bytes: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(bytes, { type: 'array', cellDates: true })
}

export function workbookSheetGrid(
  workbook: XLSX.WorkBook,
  sheetIndex: number,
): SheetGrid | null {
  const sheetName = workbook.SheetNames[sheetIndex]
  if (!sheetName) return null

  const sheet = workbook.Sheets[sheetName]
  if (!sheet?.['!ref']) {
    return { sheetName, rows: [], rowOffset: 0, colOffset: 0 }
  }

  const range = XLSX.utils.decode_range(sheet['!ref'])
  const rows: string[][] = []

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const cells: string[] = []
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col })
      cells.push(cellDisplayText(sheet[address]))
    }
    rows.push(cells)
  }

  return {
    sheetName,
    rows,
    rowOffset: range.s.r,
    colOffset: range.s.c,
  }
}

/** Ingest block ids: `{docId}:xlsx-{sheetIndex}-{row}` */
export function parseSpreadsheetBlockLocation(
  blockId: string,
): { sheetIndex: number; row: number } | null {
  const match = /:xlsx-(\d+)-(\d+)$/.exec(blockId)
  if (!match) return null
  return { sheetIndex: Number(match[1]), row: Number(match[2]) }
}

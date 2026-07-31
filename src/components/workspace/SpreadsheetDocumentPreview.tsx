import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'

import type { DocumentMeta } from '@/lib/types'
import {
  isSpreadsheetDocument,
  spreadsheetFormatLabel,
} from '@/lib/document-preview'
import {
  parseSpreadsheetBlockLocation,
  readSpreadsheetWorkbook,
  workbookSheetGrid,
} from '@/lib/spreadsheet-workbook'
import { getDocumentBytes } from '@/services/document-bytes-cache'
import { useSessionStore } from '@/store/session-store'
import { cn } from '@/lib/utils'

type SpreadsheetDocumentPreviewProps = {
  document: DocumentMeta
  className?: string
}

function ViewerState({
  title,
  message,
  className,
}: {
  title: string
  message: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-border bg-surface text-muted-foreground flex h-full min-h-[20rem] flex-col items-center justify-center gap-2 rounded-panel border px-6 text-center text-sm',
        className,
      )}
    >
      <p className="text-foreground font-medium">{title}</p>
      <p className="text-subtle-foreground max-w-sm text-xs">{message}</p>
    </div>
  )
}

/** Grid preview for Excel, ODS, and Google Sheets exports (.xlsx). */
export function SpreadsheetDocumentPreview({
  document,
  className,
}: SpreadsheetDocumentPreviewProps) {
  const selectedCitation = useSessionStore((state) => state.selectedCitation)
  const citationFocusSeq = useSessionStore((state) => state.citationFocusSeq)
  const highlightRowRef = useRef<HTMLTableRowElement>(null)

  const bytes = useMemo(() => getDocumentBytes(document.doc_id), [document.doc_id])

  const workbookResult = useMemo(() => {
    if (!bytes) return { error: null as string | null, workbook: null as XLSX.WorkBook | null }
    try {
      const copy = new Uint8Array(bytes)
      return { error: null, workbook: readSpreadsheetWorkbook(copy.buffer) }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not parse spreadsheet'
      return { error: message, workbook: null }
    }
  }, [bytes])

  const citationLocation = useMemo(() => {
    if (selectedCitation?.doc_id !== document.doc_id) return null
    return parseSpreadsheetBlockLocation(selectedCitation.block_id)
  }, [document.doc_id, selectedCitation?.block_id, selectedCitation?.doc_id])

  const [activeSheetIndex, setActiveSheetIndex] = useState(0)

  useEffect(() => {
    if (citationLocation != null) {
      setActiveSheetIndex(citationLocation.sheetIndex)
    }
  }, [citationLocation?.sheetIndex, citationFocusSeq])

  const sheetNames = workbookResult.workbook?.SheetNames ?? []
  const grid = useMemo(() => {
    if (!workbookResult.workbook) return null
    return workbookSheetGrid(workbookResult.workbook, activeSheetIndex)
  }, [activeSheetIndex, workbookResult.workbook])

  const highlightedRow =
    citationLocation != null && citationLocation.sheetIndex === activeSheetIndex
      ? citationLocation.row
      : null

  useEffect(() => {
    if (highlightedRow == null) return
    highlightRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [highlightedRow, citationFocusSeq, activeSheetIndex])

  if (!isSpreadsheetDocument(document)) {
    return (
      <ViewerState
        className={className}
        title="Unsupported preview"
        message="This document is not a spreadsheet."
      />
    )
  }

  if (!bytes) {
    return (
      <ViewerState
        className={className}
        title="Spreadsheet not in memory"
        message="Re-upload this file to preview sheets in the session."
      />
    )
  }

  if (workbookResult.error) {
    return (
      <ViewerState
        className={className}
        title="Failed to open spreadsheet"
        message={workbookResult.error}
      />
    )
  }

  const formatLabel = spreadsheetFormatLabel(document)

  return (
    <section
      className={cn(
        'border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden',
        className,
      )}
    >
      <header className="border-border/70 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-foreground truncate text-sm font-semibold">{document.filename}</h2>
          <p className="text-muted-foreground text-xs">
            Sheet preview · Excel, Google Sheets export, and LibreOffice Calc (.ods)
          </p>
        </div>
        <span className="border-border bg-muted/50 text-foreground shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium">
          {formatLabel}
        </span>
      </header>

      {sheetNames.length > 1 ? (
        <div className="border-border/60 bg-workspace flex shrink-0 gap-1 overflow-x-auto border-b px-3 py-2">
          {sheetNames.map((name, index) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveSheetIndex(index)}
              className={cn(
                'shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                index === activeSheetIndex
                  ? 'bg-surface text-foreground border-border border shadow-sm'
                  : 'text-muted-foreground hover:bg-surface/80 hover:text-foreground',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      ) : grid?.sheetName ? (
        <div className="border-border/60 bg-workspace text-muted-foreground shrink-0 border-b px-4 py-1.5 text-xs">
          {grid.sheetName}
        </div>
      ) : null}

      <div className="bg-workspace min-h-0 flex-1 overflow-auto p-3 sm:p-4">
        {!grid || grid.rows.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">This sheet has no cells.</p>
        ) : (
          <div className="border-border bg-surface inline-block min-w-full overflow-hidden rounded-lg border shadow-sm">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-workspace-muted/80 text-muted-foreground border-border border-b">
                  <th className="border-border w-10 border-r px-2 py-1.5 text-center font-medium" />
                  {grid.rows[0]?.map((_, colIndex) => (
                    <th
                      key={colIndex}
                      className="border-border border-r px-2 py-1.5 font-medium last:border-r-0"
                    >
                      {XLSX.utils.encode_col(grid.colOffset + colIndex)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row, rowIndex) => {
                  const absoluteRow = grid.rowOffset + rowIndex
                  const isHighlighted = highlightedRow === absoluteRow

                  return (
                    <tr
                      key={absoluteRow}
                      ref={isHighlighted ? highlightRowRef : undefined}
                      className={cn(
                        'border-border/70 border-b last:border-b-0',
                        isHighlighted && 'bg-violet-50 ring-1 ring-inset ring-violet-300',
                      )}
                    >
                      <td className="bg-workspace-muted/50 text-muted-foreground border-border border-r px-2 py-1.5 text-center font-medium">
                        {absoluteRow + 1}
                      </td>
                      {row.map((cell, colIndex) => (
                        <td
                          key={colIndex}
                          className={cn(
                            'border-border max-w-[16rem] truncate border-r px-2 py-1.5 align-top last:border-r-0',
                            cell ? 'text-foreground' : 'text-subtle-foreground/40',
                          )}
                          title={cell || undefined}
                        >
                          {cell || '\u00a0'}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

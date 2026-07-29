import type { DuckdbQueryParam } from '@/lib/duckdb-protocol'
import {
  getShareTableById,
  getShareTablesInClearOrder,
  getShareTablesInImportOrder,
  type ShareTableDefinition,
  type ShareTableId,
  type ShareTableRow,
} from '@/lib/share-table'
import type { DuckdbClient } from '@/services/duckdb-client'
import { getDuckdbClient } from '@/services/duckdb-client'

function normalizeRow(row: Record<string, unknown>, columns: readonly string[]): ShareTableRow {
  const normalized: ShareTableRow = {}
  for (const column of columns) {
    const value = row[column]
    if (value == null) {
      normalized[column] = null
    } else if (typeof value === 'number') {
      normalized[column] = value
    } else {
      normalized[column] = String(value)
    }
  }
  return normalized
}

export async function exportShareTables(): Promise<Record<ShareTableId, ShareTableRow[]>> {
  const duckdb = await getDuckdbClient()
  const tables = {} as Record<ShareTableId, ShareTableRow[]>

  for (const definition of getShareTablesInImportOrder()) {
    const rows = await duckdb.query<Record<string, unknown>>(definition.selectSql)
    tables[definition.id] = rows.map((row) => normalizeRow(row, definition.columns))
  }

  return tables
}

export async function clearShareTables(duckdb?: DuckdbClient): Promise<void> {
  const client = duckdb ?? (await getDuckdbClient())
  for (const definition of getShareTablesInClearOrder()) {
    await client.query(`DELETE FROM ${definition.tableName}`)
  }
}

export async function importShareTableRows(
  tables: Record<ShareTableId, ShareTableRow[]>,
  duckdb?: DuckdbClient,
): Promise<void> {
  const client = duckdb ?? (await getDuckdbClient())
  await clearShareTables(client)

  for (const definition of getShareTablesInImportOrder()) {
    const rows = tables[definition.id] ?? []
    for (const row of rows) {
      await insertShareTableRow(client, definition, row)
    }
  }
}

async function insertShareTableRow(
  duckdb: DuckdbClient,
  definition: ShareTableDefinition,
  row: ShareTableRow,
): Promise<void> {
  const placeholders = definition.columns.map(() => '?').join(', ')
  const values = definition.columns.map((column) => {
    const value = row[column]
    if (value == null) return null
    return value
  }) as DuckdbQueryParam[]

  await duckdb.query(
    `INSERT OR REPLACE INTO ${definition.tableName} (${definition.columns.join(', ')})
     VALUES (${placeholders})`,
    values,
  )
}

export function countShareTableRows(
  tables: Record<ShareTableId, ShareTableRow[]>,
): Record<ShareTableId, number> {
  const counts = {} as Record<ShareTableId, number>
  for (const definition of getShareTablesInImportOrder()) {
    counts[definition.id] = tables[definition.id]?.length ?? 0
  }
  return counts
}

export function assertShareTablesShape(
  tables: Record<ShareTableId, ShareTableRow[]>,
): Record<ShareTableId, ShareTableRow[]> {
  const normalized = {} as Record<ShareTableId, ShareTableRow[]>

  for (const definition of getShareTablesInImportOrder()) {
    const rows = tables[definition.id]
    if (!Array.isArray(rows)) {
      throw new Error(`Share pack missing table: ${definition.id}`)
    }

    for (const row of rows) {
      for (const column of definition.columns) {
        if (!(column in row)) {
          throw new Error(`Share pack row missing column ${column} in ${definition.id}`)
        }
      }
    }

    normalized[definition.id] = rows
  }

  return normalized
}

/** Dev helper — verify registry covers every table id exactly once. */
export function validateShareTableRegistry(): void {
  const ids = new Set<ShareTableId>()
  for (const definition of getShareTablesInImportOrder()) {
    getShareTableById(definition.id)
    if (ids.has(definition.id)) {
      throw new Error(`Duplicate share table id: ${definition.id}`)
    }
    ids.add(definition.id)
  }
}

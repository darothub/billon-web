import { Client as PgClient } from 'pg'
import { LEGACY, selectList, type TableMap } from './legacy-schema'

/**
 * Reading the old Java database.
 *
 * Read-only throughout: this opens a connection, selects, and closes. It never writes
 * to the old database, so a rehearsal against a restored copy cannot damage anything,
 * and pointing it at the live one by mistake cannot either.
 */

export type Row = Record<string, unknown>

export class LegacySource {
  private readonly client: PgClient

  constructor(url: string) {
    this.client = new PgClient({ connectionString: url })
  }

  async open(): Promise<void> {
    await this.client.connect()
  }

  async close(): Promise<void> {
    await this.client.end()
  }

  private async readAll(map: TableMap, orderBy = 'id'): Promise<Row[]> {
    const result = await this.client.query(
      `SELECT ${selectList(map)} FROM "${map.table}" ORDER BY "${orderBy}"`
    )
    return result.rows as Row[]
  }

  accounts(): Promise<Row[]> {
    return this.readAll(LEGACY.account)
  }

  clients(): Promise<Row[]> {
    return this.readAll(LEGACY.client)
  }

  invoices(): Promise<Row[]> {
    return this.readAll(LEGACY.invoice)
  }

  invoiceLines(): Promise<Row[]> {
    return this.readAll(LEGACY.invoiceLine)
  }

}

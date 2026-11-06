/**
 * What the old Java database is assumed to look like.
 *
 * Every table and column name the mover reads is in this one file, on purpose. The
 * These names match the Java entity annotations inspected on 2026-09-11. They still
 * have to be checked against a restored production database before changeover.
 *
 * Before the rehearsal, open a copy of the old database and check each name below:
 *
 *   \dt                       -- the tables
 *   \d users                  -- the columns of each one
 *
 * Correcting a name here is the whole change. Nothing else in the mover needs
 * touching, and the rehearsal in tests/migration/migrate.test.ts is what proves the
 * corrections are right.
 */

export interface TableMap {
  table: string
  columns: Record<string, string>
}

export const LEGACY: Record<string, TableMap> = {
  account: {
    table: 'users',
    columns: {
      id: 'id',
      email: 'email',
      passwordHash: 'password_hash',
      firstName: 'first_name',
      lastName: 'last_name',
      defaultCurrency: 'default_currency',
      invoicePrefix: 'invoice_prefix',
      invoiceNextNumber: 'invoice_next_number',
      taxLabel: 'tax_label',
      bankName: 'bank_name',
      bankAccountNumber: 'bank_account_number',
      bankSortCode: 'bank_sort_code',
      paymentDetails: 'payment_details',
      logoUrl: 'logo_url',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  client: {
    table: 'clients',
    columns: {
      id: 'id',
      accountId: 'user_id',
      name: 'name',
      email: 'email',
      companyName: 'company_name',
      addressLine1: 'address_line1',
      addressLine2: 'address_line2',
      city: 'city',
      postcode: 'postcode',
      country: 'country',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  invoice: {
    table: 'invoices',
    columns: {
      id: 'id',
      accountId: 'user_id',
      clientId: 'client_id',
      invoiceNumber: 'invoice_number',
      status: 'status',
      issueDate: 'issue_date',
      dueDate: 'due_date',
      currency: 'currency',
      taxLabel: 'tax_label',
      taxEntries: 'tax_entries',
      note: 'note',
      subtotal: 'subtotal',
      taxTotal: 'tax_total',
      total: 'total',
      sentAt: 'sent_at',
      paidAt: 'paid_at',
      voidedAt: 'voided_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  invoiceLine: {
    table: 'invoice_line_items',
    columns: {
      id: 'id',
      invoiceId: 'invoice_id',
      description: 'description',
      quantity: 'quantity',
      unitRate: 'unit_rate',
      taxRate: 'tax_rate',
      position: 'position',
    },
  },
}

/** `"first_name" AS "firstName", …` — the select list for one table. */
export function selectList(map: TableMap): string {
  return Object.entries(map.columns)
    .map(([field, column]) => `"${column}" AS "${field}"`)
    .join(', ')
}

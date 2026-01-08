/**
 * Invoice API handlers
 */

import type { D1Database, InvoiceRecord, SourceFileRecord } from '../utils/database';

export interface InvoiceListItem {
  id: number;
  message_id: string;
  supplier: string | null;
  amount: number | null;
  invoice_id: string | null;
  last_payment_date: string | null;
  paid: number;
  paid_at: string | null;
  created_at: string;
}

export interface InvoiceDetail extends InvoiceListItem {
  account_to_pay_IBAN: string | null;
  account_to_pay_BIC: string | null;
  account_to_pay_REG: string | null;
  account_to_pay_ACCOUNT_NUMBER: string | null;
  items_json: string | null;
  source_files: SourceFileRecord[];
}

export async function getAllInvoices(
  db: D1Database,
  options?: { limit?: number; offset?: number; unpaidOnly?: boolean }
): Promise<InvoiceListItem[]> {
  let query = `SELECT id, message_id, supplier, amount, invoice_id,
               last_payment_date, paid, paid_at, created_at
               FROM invoices`;

  if (options?.unpaidOnly) {
    query += ` WHERE paid = 0`;
  }

  query += ` ORDER BY created_at DESC`;

  if (options?.limit) {
    query += ` LIMIT ${options.limit}`;
    if (options?.offset) {
      query += ` OFFSET ${options.offset}`;
    }
  }

  const result = await db.prepare(query).all<InvoiceListItem>();
  return result.results;
}

export async function getInvoiceById(
  db: D1Database,
  id: number
): Promise<InvoiceDetail | null> {
  const invoice = await db
    .prepare(`SELECT * FROM invoices WHERE id = ?`)
    .bind(id)
    .first<InvoiceRecord>();

  if (!invoice) {
    return null;
  }

  const sourceFilesResult = await db
    .prepare(`SELECT * FROM source_files WHERE message_id = ?`)
    .bind(invoice.message_id)
    .all<SourceFileRecord>();

  return {
    ...invoice,
    id: invoice.id!,
    paid: invoice.paid ? 1 : 0,
    source_files: sourceFilesResult.results,
  };
}

export async function markInvoiceAsPaid(
  db: D1Database,
  id: number
): Promise<boolean> {
  const result = await db
    .prepare(`UPDATE invoices SET paid = 1, paid_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();

  return result.success;
}

export async function deleteInvoice(
  db: D1Database,
  id: number
): Promise<boolean> {
  // First get the invoice to find its message_id
  const invoice = await db
    .prepare(`SELECT message_id FROM invoices WHERE id = ?`)
    .bind(id)
    .first<{ message_id: string }>();

  if (!invoice) {
    return false;
  }

  // Delete associated source files first (foreign key constraint)
  await db
    .prepare(`DELETE FROM source_files WHERE message_id = ?`)
    .bind(invoice.message_id)
    .run();

  // Delete the invoice
  const result = await db
    .prepare(`DELETE FROM invoices WHERE id = ?`)
    .bind(id)
    .run();

  return result.success;
}

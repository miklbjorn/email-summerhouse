/**
 * Invoice API handlers
 */

import type { D1Database, InvoiceRecord, SourceFileRecord } from '../utils/database';

export type InvoiceStatus = 'unpaid' | 'paid' | 'no_payment_due';

export interface InvoiceListItem {
  id: number;
  message_id: string;
  supplier: string | null;
  amount: number | null;
  currency: string | null;
  account_balance: number | null;
  invoice_id: string | null;
  last_payment_date: string | null;
  status: InvoiceStatus;
  paid_at: string | null;
  created_at: string;
  manually_edited_fields: string[] | null;
}

export interface InvoiceDetail extends InvoiceListItem {
  account_to_pay_IBAN: string | null;
  account_to_pay_BIC: string | null;
  account_to_pay_REG: string | null;
  account_to_pay_ACCOUNT_NUMBER: string | null;
  items_json: string | null;
  manually_edited_fields: string[] | null;
  source_files: SourceFileRecord[];
}

// Fields that can be updated by the user
export type EditableField =
  | 'supplier'
  | 'amount'
  | 'currency'
  | 'account_balance'
  | 'invoice_id'
  | 'account_to_pay_IBAN'
  | 'account_to_pay_BIC'
  | 'account_to_pay_REG'
  | 'account_to_pay_ACCOUNT_NUMBER'
  | 'last_payment_date'
  | 'status';

export interface InvoiceUpdateRequest {
  supplier?: string | null;
  amount?: number | null;
  currency?: string | null;
  account_balance?: number | null;
  invoice_id?: string | null;
  account_to_pay_IBAN?: string | null;
  account_to_pay_BIC?: string | null;
  account_to_pay_REG?: string | null;
  account_to_pay_ACCOUNT_NUMBER?: string | null;
  last_payment_date?: string | null;
  status?: InvoiceStatus;
}

// Helper to parse manually_edited_fields JSON string to array
function parseManuallyEditedFields(json: string | null): string[] | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function getAllInvoices(
  db: D1Database,
  options?: { limit?: number; offset?: number; unpaidOnly?: boolean }
): Promise<InvoiceListItem[]> {
  let query = `SELECT id, message_id, supplier, amount, currency, account_balance, invoice_id,
               last_payment_date, status, paid_at, created_at, manually_edited_fields
               FROM invoices`;

  if (options?.unpaidOnly) {
    query += ` WHERE status = 'unpaid'`;
  }

  query += ` ORDER BY created_at DESC`;

  if (options?.limit) {
    query += ` LIMIT ${options.limit}`;
    if (options?.offset) {
      query += ` OFFSET ${options.offset}`;
    }
  }

  const result = await db.prepare(query).all<InvoiceRecord>();
  return result.results.map((invoice) => ({
    ...invoice,
    id: invoice.id!,
    manually_edited_fields: parseManuallyEditedFields(invoice.manually_edited_fields),
  }));
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
    manually_edited_fields: parseManuallyEditedFields(invoice.manually_edited_fields),
    source_files: sourceFilesResult.results,
  };
}

export async function markInvoiceAsPaid(
  db: D1Database,
  id: number
): Promise<boolean> {
  const result = await db
    .prepare(`UPDATE invoices SET status = 'paid', paid_at = datetime('now') WHERE id = ?`)
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

export async function updateInvoice(
  db: D1Database,
  id: number,
  updates: InvoiceUpdateRequest
): Promise<InvoiceDetail | null> {
  // First get the current invoice to merge manually_edited_fields
  const currentInvoice = await db
    .prepare(`SELECT manually_edited_fields, status FROM invoices WHERE id = ?`)
    .bind(id)
    .first<{ manually_edited_fields: string | null; status: InvoiceStatus }>();

  if (!currentInvoice) {
    return null;
  }

  // Parse existing manually edited fields
  const existingEditedFields = parseManuallyEditedFields(currentInvoice.manually_edited_fields) || [];

  // Determine which fields are being updated
  const fieldsBeingUpdated = Object.keys(updates) as EditableField[];

  // Merge with existing edited fields (no duplicates)
  const newEditedFields = [...new Set([...existingEditedFields, ...fieldsBeingUpdated])];

  // Build dynamic UPDATE query
  const setClauses: string[] = [];
  const values: unknown[] = [];

  // Add each field that's being updated
  if (updates.supplier !== undefined) {
    setClauses.push('supplier = ?');
    values.push(updates.supplier);
  }
  if (updates.amount !== undefined) {
    setClauses.push('amount = ?');
    values.push(updates.amount);
  }
  if (updates.currency !== undefined) {
    setClauses.push('currency = ?');
    values.push(updates.currency);
  }
  if (updates.account_balance !== undefined) {
    setClauses.push('account_balance = ?');
    values.push(updates.account_balance);
  }
  if (updates.invoice_id !== undefined) {
    setClauses.push('invoice_id = ?');
    values.push(updates.invoice_id);
  }
  if (updates.account_to_pay_IBAN !== undefined) {
    setClauses.push('account_to_pay_IBAN = ?');
    values.push(updates.account_to_pay_IBAN);
  }
  if (updates.account_to_pay_BIC !== undefined) {
    setClauses.push('account_to_pay_BIC = ?');
    values.push(updates.account_to_pay_BIC);
  }
  if (updates.account_to_pay_REG !== undefined) {
    setClauses.push('account_to_pay_REG = ?');
    values.push(updates.account_to_pay_REG);
  }
  if (updates.account_to_pay_ACCOUNT_NUMBER !== undefined) {
    setClauses.push('account_to_pay_ACCOUNT_NUMBER = ?');
    values.push(updates.account_to_pay_ACCOUNT_NUMBER);
  }
  if (updates.last_payment_date !== undefined) {
    setClauses.push('last_payment_date = ?');
    values.push(updates.last_payment_date);
  }
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
    // If changing to 'paid', set paid_at; if changing from 'paid', clear paid_at
    if (updates.status === 'paid') {
      setClauses.push("paid_at = datetime('now')");
    } else if (currentInvoice.status === 'paid') {
      // We're in else branch so updates.status is not 'paid', clear paid_at
      setClauses.push('paid_at = NULL');
    }
  }

  // Always update manually_edited_fields
  setClauses.push('manually_edited_fields = ?');
  values.push(JSON.stringify(newEditedFields));

  // Add id for WHERE clause
  values.push(id);

  const query = `UPDATE invoices SET ${setClauses.join(', ')} WHERE id = ?`;
  await db.prepare(query).bind(...values).run();

  // Return the updated invoice
  return getInvoiceById(db, id);
}

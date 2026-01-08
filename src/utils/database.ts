/**
 * D1 Database utilities for storing invoice data
 */

import type { InvoiceExtraction } from './ai-processing';

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Result<T> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    rows_read: number;
    rows_written: number;
  };
}

export interface D1ExecResult {
  duration: number;
  rows_read: number;
  rows_written: number;
}

export interface InvoiceRecord {
  id?: number;
  message_id: string;
  supplier: string | null;
  amount: number | null;
  currency: string | null;
  invoice_id: string | null;
  account_to_pay_IBAN: string | null;
  account_to_pay_BIC: string | null;
  account_to_pay_REG: string | null;
  account_to_pay_ACCOUNT_NUMBER: string | null;
  last_payment_date: string | null;
  items_json: string | null; // JSON array of items
  paid: boolean;
  paid_at: string | null;
  created_at: string;
}

export interface SourceFileRecord {
  id?: number;
  message_id: string;
  filename: string;
  blob_uri: string;
  created_at: string;
}

/**
 * Initialize database schema (should be run once)
 * This creates the invoices table if it doesn't exist
 */
export async function initializeDatabase(db: D1Database): Promise<void> {
  // Execute statements separately to avoid issues with multi-statement exec
  const statements = [
    `CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL UNIQUE,
      supplier TEXT,
      amount REAL,
      currency TEXT,
      invoice_id TEXT,
      account_to_pay_IBAN TEXT,
      account_to_pay_BIC TEXT,
      account_to_pay_REG TEXT,
      account_to_pay_ACCOUNT_NUMBER TEXT,
      last_payment_date TEXT,
      items_json TEXT,
      paid INTEGER NOT NULL DEFAULT 0,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS source_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      blob_uri TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (message_id) REFERENCES invoices(message_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_message_id ON invoices(message_id)`,
    `CREATE INDEX IF NOT EXISTS idx_supplier ON invoices(supplier)`,
    `CREATE INDEX IF NOT EXISTS idx_invoice_id ON invoices(invoice_id)`,
    `CREATE INDEX IF NOT EXISTS idx_created_at ON invoices(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_source_files_message_id ON source_files(message_id)`,
    // Migration: add currency column to existing tables (will fail silently if already exists)
    `ALTER TABLE invoices ADD COLUMN currency TEXT`,
  ];

  // Execute each statement separately
  for (const statement of statements) {
    try {
      await db.prepare(statement).run();
    } catch (error) {
      // Ignore errors for IF NOT EXISTS statements (they might fail if already exist)
      // But log for debugging
      console.warn(`Database initialization warning for statement: ${statement.substring(0, 50)}...`, error);
    }
  }
}

/**
 * Insert invoice data into D1 database
 * Also inserts source files into the source_files table
 */
export async function insertInvoice(
  db: D1Database,
  messageId: string,
  extraction: InvoiceExtraction,
  sourceFiles: Array<{ filename: string; blob_uri: string }>
): Promise<InvoiceRecord> {
  const itemsJson = extraction.items && extraction.items.length > 0
    ? JSON.stringify(extraction.items)
    : null;

  // Insert invoice record
  const result = await db
    .prepare(
      `INSERT INTO invoices (
        message_id, supplier, amount, currency, invoice_id,
        account_to_pay_IBAN, account_to_pay_BIC, account_to_pay_REG, account_to_pay_ACCOUNT_NUMBER,
        last_payment_date, items_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *`
    )
    .bind(
      messageId,
      extraction.supplier || null,
      extraction.amount || null,
      extraction.currency || null,
      extraction.invoiceId || null,
      extraction.accountIBAN || null,
      extraction.accountBIC || null,
      extraction.accountREG || null,
      extraction.accountNumber || null,
      extraction.lastPaymentDate || null,
      itemsJson
    )
    .first<InvoiceRecord>();

  if (!result) {
    throw new Error('Failed to insert invoice record');
  }

  // Insert source files
  if (sourceFiles.length > 0) {
    const insertSourceFile = db.prepare(
      `INSERT INTO source_files (message_id, filename, blob_uri) VALUES (?, ?, ?)`
    );

    // Use batch insert for efficiency
    const statements = sourceFiles.map((file) =>
      insertSourceFile.bind(messageId, file.filename, file.blob_uri)
    );

    await db.batch(statements);
  }

  return result;
}

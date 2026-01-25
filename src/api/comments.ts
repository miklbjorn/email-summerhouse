/**
 * Invoice Comments API handlers
 */

import type { D1Database } from '../utils/database';

export interface InvoiceComment {
  id: number;
  invoice_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCommentRequest {
  content: string;
}

export interface UpdateCommentRequest {
  content: string;
}

export async function getCommentsByInvoiceId(
  db: D1Database,
  invoiceId: number
): Promise<InvoiceComment[]> {
  const result = await db
    .prepare(`SELECT * FROM invoice_comments WHERE invoice_id = ? ORDER BY created_at ASC`)
    .bind(invoiceId)
    .all<InvoiceComment>();

  return result.results;
}

export async function createComment(
  db: D1Database,
  invoiceId: number,
  content: string
): Promise<InvoiceComment | null> {
  const result = await db
    .prepare(
      `INSERT INTO invoice_comments (invoice_id, content) VALUES (?, ?) RETURNING *`
    )
    .bind(invoiceId, content)
    .first<InvoiceComment>();

  return result;
}

export async function updateComment(
  db: D1Database,
  commentId: number,
  content: string
): Promise<InvoiceComment | null> {
  const result = await db
    .prepare(
      `UPDATE invoice_comments SET content = ?, updated_at = datetime('now') WHERE id = ? RETURNING *`
    )
    .bind(content, commentId)
    .first<InvoiceComment>();

  return result;
}

export async function deleteComment(
  db: D1Database,
  commentId: number
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM invoice_comments WHERE id = ?`)
    .bind(commentId)
    .run();

  return result.success && result.meta.rows_written > 0;
}

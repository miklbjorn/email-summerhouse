-- Migration: Add 'check_up' status and invoice comments table
-- Status values: 'unpaid', 'paid', 'no_payment_due', 'check_up'
-- Note: check_up status should only be set manually, never auto-filled during email processing

-- Create comments table
CREATE TABLE IF NOT EXISTS invoice_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Index for faster comment lookups by invoice
CREATE INDEX IF NOT EXISTS idx_invoice_comments_invoice_id ON invoice_comments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_comments_created_at ON invoice_comments(created_at);

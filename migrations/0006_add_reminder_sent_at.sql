-- Track when a "due soon" reminder was sent for an invoice, so each invoice
-- only triggers the 3-days-before-due reminder once
ALTER TABLE invoices ADD COLUMN reminder_sent_at TEXT;

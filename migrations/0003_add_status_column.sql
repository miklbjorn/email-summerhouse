-- Migration: Replace paid boolean with status enum
-- Status values: 'unpaid', 'paid', 'no_payment_due'

-- Add status column
ALTER TABLE invoices ADD COLUMN status TEXT NOT NULL DEFAULT 'unpaid';

-- Migrate existing data
UPDATE invoices SET status = 'paid' WHERE paid = 1;
UPDATE invoices SET status = 'no_payment_due' WHERE paid = 0 AND account_balance IS NOT NULL AND (amount IS NULL OR amount = 0);

-- Note: We keep paid and paid_at columns for now to avoid data loss
-- They can be removed in a future migration after verifying the status column works correctly

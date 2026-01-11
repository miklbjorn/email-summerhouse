-- Add column to track which fields have been manually edited by the user
-- Stores a JSON array of field names, e.g. ["amount", "supplier"]
ALTER TABLE invoices ADD COLUMN manually_edited_fields TEXT;

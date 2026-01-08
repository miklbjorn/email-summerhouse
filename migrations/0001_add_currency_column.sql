-- Migration: Add currency column to invoices table
-- This allows storing the currency code (DKK, SEK, EUR, etc.) for each invoice

ALTER TABLE invoices ADD COLUMN currency TEXT;

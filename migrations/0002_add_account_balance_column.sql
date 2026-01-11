-- Migration: Add account_balance column to invoices table
-- This allows storing positive credit balances (tilgodehavende) separately from amounts to pay

ALTER TABLE invoices ADD COLUMN account_balance REAL;

CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL UNIQUE,
      supplier TEXT,
      amount REAL,
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
    );

    CREATE TABLE IF NOT EXISTS source_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (message_id) REFERENCES invoices(message_id)
    );

    CREATE INDEX IF NOT EXISTS idx_message_id ON invoices(message_id);
    CREATE INDEX IF NOT EXISTS idx_supplier ON invoices(supplier);
    CREATE INDEX IF NOT EXISTS idx_invoice_id ON invoices(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_created_at ON invoices(created_at);
    CREATE INDEX IF NOT EXISTS idx_source_files_message_id ON source_files(message_id);
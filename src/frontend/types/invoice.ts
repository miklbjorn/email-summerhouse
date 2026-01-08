export interface InvoiceListItem {
  id: number;
  message_id: string;
  supplier: string | null;
  amount: number | null;
  currency: string | null;
  invoice_id: string | null;
  last_payment_date: string | null;
  paid: number;
  paid_at: string | null;
  created_at: string;
}

export interface SourceFile {
  id: number;
  message_id: string;
  filename: string;
  blob_uri: string;
  created_at: string;
}

export interface InvoiceDetail extends InvoiceListItem {
  account_to_pay_IBAN: string | null;
  account_to_pay_BIC: string | null;
  account_to_pay_REG: string | null;
  account_to_pay_ACCOUNT_NUMBER: string | null;
  items_json: string | null;
  source_files: SourceFile[];
}

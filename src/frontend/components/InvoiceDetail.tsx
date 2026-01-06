import { useState, useEffect } from 'react';
import { SourceFileViewer } from './SourceFileViewer';
import type { InvoiceDetail as InvoiceDetailType } from '../types/invoice';

interface Props {
  invoiceId: number;
  onBack: () => void;
  onMarkPaid: (id: number) => void;
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return '-';
  return amount.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' });
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('da-DK');
}

export function InvoiceDetail({ invoiceId, onBack, onMarkPaid }: Props) {
  const [invoice, setInvoice] = useState<InvoiceDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    fetch(`/api/invoices/${invoiceId}`)
      .then((res) => res.json() as Promise<InvoiceDetailType>)
      .then((data) => {
        setInvoice(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to fetch invoice:', error);
        setLoading(false);
      });
  }, [invoiceId]);

  if (loading) {
    return <div className="loading">Loading invoice...</div>;
  }

  if (!invoice) {
    return <div className="empty-state">Invoice not found</div>;
  }

  const items: string[] = invoice.items_json ? JSON.parse(invoice.items_json) : [];

  async function handleMarkPaid() {
    setMarking(true);
    await onMarkPaid(invoice!.id);
    setMarking(false);
  }

  return (
    <div className="invoice-detail">
      <button className="back-button" onClick={onBack}>
        &larr; Back to List
      </button>

      <div className="detail-section">
        <h2>Invoice Details</h2>
        <dl className="detail-grid">
          <div className="detail-item">
            <dt>Supplier</dt>
            <dd>{invoice.supplier || '-'}</dd>
          </div>
          <div className="detail-item">
            <dt>Invoice ID</dt>
            <dd>{invoice.invoice_id || '-'}</dd>
          </div>
          <div className="detail-item">
            <dt>Amount</dt>
            <dd>{formatCurrency(invoice.amount)}</dd>
          </div>
          <div className="detail-item">
            <dt>Due Date</dt>
            <dd>{formatDate(invoice.last_payment_date)}</dd>
          </div>
          <div className="detail-item">
            <dt>Status</dt>
            <dd>
              <span className={`status-badge ${invoice.paid ? 'paid' : 'unpaid'}`}>
                {invoice.paid ? `Paid on ${formatDate(invoice.paid_at)}` : 'Unpaid'}
              </span>
            </dd>
          </div>
          <div className="detail-item">
            <dt>Received</dt>
            <dd>{formatDate(invoice.created_at)}</dd>
          </div>
        </dl>
      </div>

      {(invoice.account_to_pay_IBAN ||
        invoice.account_to_pay_BIC ||
        invoice.account_to_pay_REG ||
        invoice.account_to_pay_ACCOUNT_NUMBER) && (
        <div className="detail-section">
          <h2>Payment Information</h2>
          <dl className="detail-grid">
            {invoice.account_to_pay_IBAN && (
              <div className="detail-item">
                <dt>IBAN</dt>
                <dd>{invoice.account_to_pay_IBAN}</dd>
              </div>
            )}
            {invoice.account_to_pay_BIC && (
              <div className="detail-item">
                <dt>BIC</dt>
                <dd>{invoice.account_to_pay_BIC}</dd>
              </div>
            )}
            {invoice.account_to_pay_REG && (
              <div className="detail-item">
                <dt>REG</dt>
                <dd>{invoice.account_to_pay_REG}</dd>
              </div>
            )}
            {invoice.account_to_pay_ACCOUNT_NUMBER && (
              <div className="detail-item">
                <dt>Account Number</dt>
                <dd>{invoice.account_to_pay_ACCOUNT_NUMBER}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {items.length > 0 && (
        <div className="detail-section">
          <h2>Line Items</h2>
          <ul className="items-list">
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {invoice.source_files.length > 0 && (
        <div className="detail-section">
          <h2>Source Files</h2>
          <ul className="source-files-list">
            {invoice.source_files.map((file) => (
              <li key={file.id}>
                <button
                  className="source-file-button"
                  onClick={() => setSelectedFile(file.blob_uri)}
                >
                  {file.filename}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!invoice.paid && (
        <div className="detail-section">
          <button
            className="mark-paid-button"
            onClick={handleMarkPaid}
            disabled={marking}
          >
            {marking ? 'Marking as paid...' : 'Mark as Paid'}
          </button>
        </div>
      )}

      {selectedFile && (
        <SourceFileViewer
          blobUri={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}

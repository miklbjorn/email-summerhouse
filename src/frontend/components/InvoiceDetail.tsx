import { useState, useEffect } from 'react';
import { PDFViewer } from './PDFViewer';
import { ImageViewer } from './ImageViewer';
import { CopyableField } from './CopyableField';
import type { InvoiceDetail as InvoiceDetailType } from '../types/invoice';

interface Props {
  invoiceId: number;
  onBack: () => void;
  onMarkPaid: (id: number) => void;
}

function formatCurrency(amount: number | null, currency: string | null): string {
  if (amount === null) return '-';
  const currencyCode = currency || 'DKK';
  return amount.toLocaleString('da-DK', { style: 'currency', currency: currencyCode });
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
        // Auto-select first source file
        if (data.source_files.length > 0) {
          setSelectedFile(data.source_files[0].blob_uri);
        }
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

  const fileUrl = selectedFile ? `/api/files/${encodeURIComponent(selectedFile)}` : null;
  const isPdf = selectedFile?.toLowerCase().endsWith('.pdf');
  const isImage = selectedFile ? /\.(png|jpg|jpeg|gif|webp)$/i.test(selectedFile) : false;
  const selectedFilename = selectedFile?.split('/').pop() || '';

  return (
    <div className="invoice-detail-layout">
      {/* Left Panel - Extracted Information */}
      <div className="invoice-info-panel">
        <button className="back-button" onClick={onBack}>
          &larr; Back to List
        </button>

        <div className="detail-section">
          <h2>Invoice Details</h2>
          <dl className="detail-grid">
            <CopyableField label="Supplier" value={invoice.supplier} />
            <CopyableField label="Invoice ID" value={invoice.invoice_id} />
            <CopyableField
              label="Amount"
              value={invoice.amount?.toString() ?? null}
              formatValue={(v) => formatCurrency(parseFloat(v), invoice.currency)}
            />
            <CopyableField
              label="Due Date"
              value={invoice.last_payment_date}
              formatValue={formatDate}
            />
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

        <div className="detail-section">
          <h2>Payment Information</h2>
          <dl className="detail-grid">
            <CopyableField label="IBAN" value={invoice.account_to_pay_IBAN} />
            <CopyableField label="BIC" value={invoice.account_to_pay_BIC} />
            <CopyableField label="REG" value={invoice.account_to_pay_REG} />
            <CopyableField label="Account Number" value={invoice.account_to_pay_ACCOUNT_NUMBER} />
          </dl>
        </div>

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
      </div>

      {/* Right Panel - Source File Viewer */}
      <div className="source-file-panel">
        {invoice.source_files.length > 0 && (
          <>
            <div className="source-file-tabs">
              {invoice.source_files.map((file) => (
                <button
                  key={file.id}
                  className={`source-file-tab ${selectedFile === file.blob_uri ? 'active' : ''}`}
                  onClick={() => setSelectedFile(file.blob_uri)}
                >
                  {file.filename}
                </button>
              ))}
              {fileUrl && (
                <a href={fileUrl} download={selectedFilename} className="download-link">
                  Download
                </a>
              )}
            </div>
            <div className="source-file-content">
              {isPdf && fileUrl && <PDFViewer fileUrl={fileUrl} />}
              {isImage && fileUrl && (
                <ImageViewer fileUrl={fileUrl} filename={selectedFilename} />
              )}
              {!isPdf && !isImage && fileUrl && (
                <div className="unsupported-file">
                  <p>Preview not available for this file type.</p>
                  <a href={fileUrl} download={selectedFilename}>
                    Download file
                  </a>
                </div>
              )}
              {!selectedFile && (
                <div className="no-file-selected">
                  <p>Select a source file to view</p>
                </div>
              )}
            </div>
          </>
        )}
        {invoice.source_files.length === 0 && (
          <div className="no-source-files">
            <p>No source files available</p>
          </div>
        )}
      </div>
    </div>
  );
}

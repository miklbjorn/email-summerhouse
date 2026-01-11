import { useState, useEffect } from 'react';
import { PDFViewer } from './PDFViewer';
import { ImageViewer } from './ImageViewer';
import { CopyableField } from './CopyableField';
import { ConfirmModal } from './ConfirmModal';
import type { InvoiceDetail as InvoiceDetailType } from '../types/invoice';

interface Props {
  invoiceId: number;
  onBack: () => void;
  onMarkPaid: (id: number) => void;
  onDelete: (id: number) => void;
}

function formatCurrency(amount: number | null, currency: string | null): string {
  if (amount === null) return '-';
  const currencyCode = currency || 'DKK';
  return amount.toLocaleString('da-DK', { style: 'currency', currency: currencyCode, currencyDisplay: 'code' });
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('da-DK');
}

export function InvoiceDetail({ invoiceId, onBack, onMarkPaid, onDelete }: Props) {
  const [invoice, setInvoice] = useState<InvoiceDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    setDeleting(true);
    await onDelete(invoice!.id);
    setDeleting(false);
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
            {invoice.account_balance && (
              <div className="detail-item">
                <dt>Credit Balance</dt>
                <dd>
                  <span className="status-badge balance">
                    {formatCurrency(invoice.account_balance, invoice.currency)}
                  </span>
                </dd>
              </div>
            )}
            <CopyableField
              label="Due Date"
              value={invoice.last_payment_date}
              formatValue={formatDate}
            />
            <div className="detail-item">
              <dt>Status</dt>
              <dd>
                <span className={`status-badge ${invoice.status === 'paid' ? 'paid' : (invoice.status === 'no_payment_due' ? 'balance' : 'unpaid')}`}>
                  {invoice.status === 'paid' ? `Paid on ${formatDate(invoice.paid_at)}` : (invoice.status === 'no_payment_due' ? 'All good' : 'Unpaid')}
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

        <div className="detail-section action-buttons">
          {invoice.status === 'unpaid' && (
            <button
              className="mark-paid-button"
              onClick={handleMarkPaid}
              disabled={marking}
            >
              {marking ? 'Marking as paid...' : 'Mark as Paid'}
            </button>
          )}
          <button
            className="delete-button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Invoice'}
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Invoice"
        message={`Are you sure you want to delete this invoice from ${invoice.supplier || 'unknown supplier'}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

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

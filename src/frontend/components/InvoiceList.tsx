import type { InvoiceListItem } from '../types/invoice';

interface Props {
  invoices: InvoiceListItem[];
  loading: boolean;
  onSelect: (id: number) => void;
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return '-';
  return amount.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' });
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('da-DK');
}

export function InvoiceList({ invoices, loading, onSelect }: Props) {
  if (loading) {
    return <div className="loading">Loading invoices...</div>;
  }

  if (invoices.length === 0) {
    return <div className="empty-state">No invoices found</div>;
  }

  return (
    <div className="invoice-list">
      <table className="invoice-table">
        <thead>
          <tr>
            <th>Supplier</th>
            <th>Amount</th>
            <th>Invoice ID</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} onClick={() => onSelect(invoice.id)}>
              <td>{invoice.supplier || '-'}</td>
              <td>{formatCurrency(invoice.amount)}</td>
              <td>{invoice.invoice_id || '-'}</td>
              <td>{formatDate(invoice.last_payment_date)}</td>
              <td>
                <span className={`status-badge ${invoice.paid ? 'paid' : 'unpaid'}`}>
                  {invoice.paid ? 'Paid' : 'Unpaid'}
                </span>
              </td>
              <td>{formatDate(invoice.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

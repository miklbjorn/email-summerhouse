import { useState, useMemo } from 'react';
import type { InvoiceListItem } from '../types/invoice';

interface Props {
  invoices: InvoiceListItem[];
  loading: boolean;
  onSelect: (id: number) => void;
}

type SortColumn = 'supplier' | 'amount' | 'invoice_id' | 'last_payment_date' | 'paid' | 'created_at';
type SortDirection = 'asc' | 'desc';
type PaidFilter = 'all' | 'paid' | 'unpaid';

function formatCurrency(amount: number | null, currency: string | null): string {
  if (amount === null) return '-';
  const currencyCode = currency || 'DKK';
  return amount.toLocaleString('da-DK', { style: 'currency', currency: currencyCode });
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('da-DK');
}

function SortIcon({ direction, active }: { direction: SortDirection; active: boolean }) {
  if (!active) {
    return <span className="sort-icon inactive">⇅</span>;
  }
  return <span className="sort-icon">{direction === 'asc' ? '↑' : '↓'}</span>;
}

export function InvoiceList({ invoices, loading, onSelect }: Props) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [paidFilter, setPaidFilter] = useState<PaidFilter>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('');

  const uniqueSuppliers = useMemo(() => {
    const suppliers = invoices
      .map(inv => inv.supplier)
      .filter((s): s is string => s !== null && s.trim() !== '');
    return [...new Set(suppliers)].sort();
  }, [invoices]);

  const filteredAndSortedInvoices = useMemo(() => {
    let result = [...invoices];

    // Apply paid filter
    if (paidFilter === 'paid') {
      result = result.filter(inv => inv.paid === 1);
    } else if (paidFilter === 'unpaid') {
      result = result.filter(inv => inv.paid === 0);
    }

    // Apply supplier filter
    if (supplierFilter) {
      result = result.filter(inv => inv.supplier === supplierFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      switch (sortColumn) {
        case 'supplier':
          aVal = a.supplier?.toLowerCase() ?? '';
          bVal = b.supplier?.toLowerCase() ?? '';
          break;
        case 'amount':
          aVal = a.amount ?? 0;
          bVal = b.amount ?? 0;
          break;
        case 'invoice_id':
          aVal = a.invoice_id?.toLowerCase() ?? '';
          bVal = b.invoice_id?.toLowerCase() ?? '';
          break;
        case 'last_payment_date':
          aVal = a.last_payment_date ?? '';
          bVal = b.last_payment_date ?? '';
          break;
        case 'paid':
          aVal = a.paid;
          bVal = b.paid;
          break;
        case 'created_at':
          aVal = a.created_at;
          bVal = b.created_at;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [invoices, sortColumn, sortDirection, paidFilter, supplierFilter]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  if (loading) {
    return <div className="loading">Loading invoices...</div>;
  }

  if (invoices.length === 0) {
    return <div className="empty-state">No invoices found</div>;
  }

  return (
    <div className="invoice-list">
      <div className="invoice-filters">
        <div className="filter-group">
          <label htmlFor="paid-filter">Status:</label>
          <select
            id="paid-filter"
            value={paidFilter}
            onChange={(e) => setPaidFilter(e.target.value as PaidFilter)}
          >
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="supplier-filter">Supplier:</label>
          <select
            id="supplier-filter"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="">All suppliers</option>
            {uniqueSuppliers.map(supplier => (
              <option key={supplier} value={supplier}>{supplier}</option>
            ))}
          </select>
        </div>
        {(paidFilter !== 'all' || supplierFilter) && (
          <button
            className="clear-filters-button"
            onClick={() => {
              setPaidFilter('all');
              setSupplierFilter('');
            }}
          >
            Clear filters
          </button>
        )}
      </div>
      <table className="invoice-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => handleSort('supplier')}>
              Supplier <SortIcon direction={sortDirection} active={sortColumn === 'supplier'} />
            </th>
            <th className="sortable" onClick={() => handleSort('amount')}>
              Amount <SortIcon direction={sortDirection} active={sortColumn === 'amount'} />
            </th>
            <th className="sortable" onClick={() => handleSort('invoice_id')}>
              Invoice ID <SortIcon direction={sortDirection} active={sortColumn === 'invoice_id'} />
            </th>
            <th className="sortable" onClick={() => handleSort('last_payment_date')}>
              Due Date <SortIcon direction={sortDirection} active={sortColumn === 'last_payment_date'} />
            </th>
            <th className="sortable" onClick={() => handleSort('paid')}>
              Status <SortIcon direction={sortDirection} active={sortColumn === 'paid'} />
            </th>
            <th className="sortable" onClick={() => handleSort('created_at')}>
              Created <SortIcon direction={sortDirection} active={sortColumn === 'created_at'} />
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredAndSortedInvoices.length === 0 ? (
            <tr>
              <td colSpan={6} className="no-results">No invoices match the selected filters</td>
            </tr>
          ) : (
            filteredAndSortedInvoices.map((invoice) => (
              <tr key={invoice.id} onClick={() => onSelect(invoice.id)}>
                <td>{invoice.supplier || '-'}</td>
                <td>{formatCurrency(invoice.amount, invoice.currency)}</td>
                <td>{invoice.invoice_id || '-'}</td>
                <td>{formatDate(invoice.last_payment_date)}</td>
                <td>
                  <span className={`status-badge ${invoice.paid ? 'paid' : 'unpaid'}`}>
                    {invoice.paid ? 'Paid' : 'Unpaid'}
                  </span>
                </td>
                <td>{formatDate(invoice.created_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

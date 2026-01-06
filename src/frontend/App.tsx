import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { InvoiceList } from './components/InvoiceList';
import { InvoiceDetail } from './components/InvoiceDetail';
import type { InvoiceListItem } from './types/invoice';

export function App() {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const response = await fetch('/api/invoices');
      const data: InvoiceListItem[] = await response.json();
      setInvoices(data);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function handleMarkPaid(id: number) {
    try {
      await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: true }),
      });
      await fetchInvoices();
      setSelectedInvoiceId(null);
    } catch (error) {
      console.error('Failed to mark invoice as paid:', error);
    }
  }

  return (
    <Layout>
      {selectedInvoiceId ? (
        <InvoiceDetail
          invoiceId={selectedInvoiceId}
          onBack={() => setSelectedInvoiceId(null)}
          onMarkPaid={handleMarkPaid}
        />
      ) : (
        <InvoiceList
          invoices={invoices}
          loading={loading}
          onSelect={setSelectedInvoiceId}
        />
      )}
    </Layout>
  );
}

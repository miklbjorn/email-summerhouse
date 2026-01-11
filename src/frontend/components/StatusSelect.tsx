import { useState } from 'react';
import type { InvoiceStatus } from '../types/invoice';

interface Props {
  status: InvoiceStatus;
  paidAt: string | null;
  isEdited?: boolean;
  onSave: (status: InvoiceStatus) => Promise<void>;
  formatDate: (date: string | null) => string;
}

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'no_payment_due', label: 'All good (no payment due)' },
];

export function StatusSelect({ status, paidAt, isEdited = false, onSave, formatDate }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = async (newStatus: InvoiceStatus) => {
    if (newStatus === status) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(newStatus);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save status:', err);
    } finally {
      setSaving(false);
    }
  };

  const getStatusDisplay = () => {
    if (status === 'paid') {
      return `Paid on ${formatDate(paidAt)}`;
    } else if (status === 'no_payment_due') {
      return 'All good';
    }
    return 'Unpaid';
  };

  const getStatusClass = () => {
    if (status === 'paid') return 'paid';
    if (status === 'no_payment_due') return 'balance';
    return 'unpaid';
  };

  if (isEditing) {
    return (
      <div className={`detail-item ${isEdited ? 'manually-edited' : ''}`}>
        <dt>
          Status
          {isEdited && <span className="edited-indicator" title="Manually edited">*</span>}
        </dt>
        <dd className="status-editing">
          <select
            value={status}
            onChange={(e) => handleChange(e.target.value as InvoiceStatus)}
            disabled={saving}
            className="status-select"
            autoFocus
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            className="edit-action-button cancel"
            onClick={() => setIsEditing(false)}
            disabled={saving}
            title="Cancel"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </dd>
      </div>
    );
  }

  return (
    <div className={`detail-item ${isEdited ? 'manually-edited' : ''}`}>
      <dt>
        Status
        {isEdited && <span className="edited-indicator" title="Manually edited">*</span>}
      </dt>
      <dd className="editable-field">
        <span className={`status-badge ${getStatusClass()}`}>
          {getStatusDisplay()}
        </span>
        <button
          className="edit-button"
          onClick={() => setIsEditing(true)}
          title="Edit status"
          aria-label="Edit status"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </dd>
    </div>
  );
}

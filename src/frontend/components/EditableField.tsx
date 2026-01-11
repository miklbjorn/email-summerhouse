import { useState, useCallback, useRef, useEffect } from 'react';

interface Props {
  label: string;
  fieldName: string;
  value: string | null;
  formatValue?: (value: string) => string;
  parseValue?: (displayValue: string) => string | null;
  isEdited?: boolean;
  onSave: (fieldName: string, value: string | null) => Promise<void>;
  inputType?: 'text' | 'number' | 'date';
}

export function EditableField({
  label,
  fieldName,
  value,
  formatValue,
  parseValue,
  isEdited = false,
  onSave,
  inputType = 'text',
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = value ? (formatValue ? formatValue(value) : value) : '-';
  const canCopy = value && typeof navigator !== 'undefined' && navigator.clipboard;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCopy = useCallback(async () => {
    if (!value || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [value]);

  const startEditing = () => {
    setEditValue(value || '');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const newValue = editValue.trim() || null;
      const parsedValue = parseValue ? parseValue(editValue.trim()) : newValue;
      await onSave(fieldName, parsedValue);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  if (isEditing) {
    return (
      <div className="detail-item">
        <dt>{label}</dt>
        <dd className="editable-field editing">
          <input
            ref={inputRef}
            type={inputType}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className="edit-input"
          />
          <div className="edit-actions">
            <button
              className="edit-action-button save"
              onClick={handleSave}
              disabled={saving}
              title="Save"
            >
              {saving ? '...' : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
            <button
              className="edit-action-button cancel"
              onClick={cancelEditing}
              disabled={saving}
              title="Cancel"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </dd>
      </div>
    );
  }

  return (
    <div className={`detail-item ${isEdited ? 'manually-edited' : ''}`}>
      <dt>
        {label}
        {isEdited && (
          <span className="edited-indicator" title="Manually edited">*</span>
        )}
      </dt>
      <dd className="editable-field">
        <span className={canCopy ? 'copyable-value' : ''}>
          <span>{displayValue}</span>
          {canCopy && (
            <button
              className="copy-button"
              onClick={handleCopy}
              title={copied ? 'Copied!' : 'Click to copy'}
              aria-label={`Copy ${label}`}
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          )}
        </span>
        <button
          className="edit-button"
          onClick={startEditing}
          title="Edit"
          aria-label={`Edit ${label}`}
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

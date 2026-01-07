import { useState, useCallback } from 'react';

interface Props {
  label: string;
  value: string | null;
  formatValue?: (value: string) => string;
}

export function CopyableField({ label, value, formatValue }: Props) {
  const [copied, setCopied] = useState(false);
  const displayValue = value ? (formatValue ? formatValue(value) : value) : '-';
  const canCopy = value && typeof navigator !== 'undefined' && navigator.clipboard;

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

  return (
    <div className="detail-item">
      <dt>{label}</dt>
      <dd className={canCopy ? 'copyable-value' : ''}>
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
      </dd>
    </div>
  );
}

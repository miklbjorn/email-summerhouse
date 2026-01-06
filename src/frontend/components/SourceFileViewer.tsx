interface Props {
  blobUri: string;
  onClose: () => void;
}

export function SourceFileViewer({ blobUri, onClose }: Props) {
  const fileUrl = `/api/files/${encodeURIComponent(blobUri)}`;
  const filename = blobUri.split('/').pop() || 'file';
  const isPdf = blobUri.toLowerCase().endsWith('.pdf');
  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(blobUri);

  return (
    <div className="file-viewer-overlay" onClick={onClose}>
      <div className="file-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="file-viewer-header">
          <span>{filename}</span>
          <div className="file-viewer-header-actions">
            <a href={fileUrl} download={filename}>
              Download
            </a>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="file-viewer-content">
          {isPdf && <iframe src={fileUrl} title="PDF viewer" />}
          {isImage && <img src={fileUrl} alt={filename} />}
          {!isPdf && !isImage && (
            <div className="empty-state">
              <p>Preview not available for this file type.</p>
              <p>
                <a href={fileUrl} download={filename}>
                  Download file
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the worker from CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  fileUrl: string;
}

export function PDFViewer({ fileUrl }: Props) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(0.6);
  const [error, setError] = useState<string | null>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error('PDF load error:', err);
    setError('Failed to load PDF. Try downloading the file instead.');
  }, []);

  function goToPrevPage() {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  }

  function goToNextPage() {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  }

  function zoomIn() {
    setScale((prev) => Math.min(prev + 0.1, 2.0));
  }

  function zoomOut() {
    setScale((prev) => Math.max(prev - 0.1, 0.3));
  }

  function resetZoom() {
    setScale(0.6);
  }

  if (error) {
    return (
      <div className="pdf-error">
        <p>{error}</p>
        <a href={fileUrl} download>
          Download PDF
        </a>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-controls">
        <div className="pdf-nav">
          <button onClick={goToPrevPage} disabled={pageNumber <= 1}>
            &larr; Prev
          </button>
          <span>
            Page {pageNumber} of {numPages || '...'}
          </span>
          <button onClick={goToNextPage} disabled={pageNumber >= numPages}>
            Next &rarr;
          </button>
        </div>
        <div className="pdf-zoom">
          <button onClick={zoomOut} disabled={scale <= 0.5}>
            -
          </button>
          <button onClick={resetZoom}>{Math.round(scale * 100)}%</button>
          <button onClick={zoomIn} disabled={scale >= 3.0}>
            +
          </button>
        </div>
      </div>
      <div className="pdf-document-container">
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div className="pdf-loading">Loading PDF...</div>}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            loading={<div className="pdf-loading">Loading page...</div>}
          />
        </Document>
      </div>
    </div>
  );
}

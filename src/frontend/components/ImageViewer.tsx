import { useState, useRef, useCallback, useEffect } from 'react';

interface Props {
  fileUrl: string;
  filename: string;
}

export function ImageViewer({ fileUrl, filename }: Props) {
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fitMode, setFitMode] = useState<'fit' | 'actual'>('fit');
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset position and scale when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setFitMode('fit');
  }, [fileUrl]);

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 4));
    setFitMode('actual');
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.25));
    setFitMode('actual');
  }, []);

  const fitToScreen = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setFitMode('fit');
  }, []);

  const actualSize = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setFitMode('actual');
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (fitMode === 'actual' || scale !== 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [fitMode, scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.min(Math.max(prev + delta, 0.25), 4));
    setFitMode('actual');
  }, []);

  return (
    <div className="image-viewer-container">
      <div className="image-controls">
        <div className="image-zoom">
          <button onClick={zoomOut} disabled={scale <= 0.25}>-</button>
          <span>{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} disabled={scale >= 4}>+</button>
        </div>
        <div className="image-fit-controls">
          <button
            onClick={fitToScreen}
            className={fitMode === 'fit' ? 'active' : ''}
          >
            Fit
          </button>
          <button
            onClick={actualSize}
            className={fitMode === 'actual' && scale === 1 ? 'active' : ''}
          >
            100%
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className={`image-viewport ${isDragging ? 'dragging' : ''} ${fitMode === 'actual' || scale !== 1 ? 'pannable' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <img
          ref={imageRef}
          src={fileUrl}
          alt={filename}
          className={fitMode === 'fit' ? 'fit-mode' : 'actual-mode'}
          style={{
            transform: fitMode === 'actual' || scale !== 1
              ? `translate(${position.x}px, ${position.y}px) scale(${scale})`
              : undefined,
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

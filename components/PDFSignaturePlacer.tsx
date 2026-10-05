'use client'

import { useRef, useState, useEffect } from 'react'

interface PDFSignaturePlacerProps {
  pdfUrl: string
  signatureDataUrl: string
  onConfirm: (placement: {
    x: number
    y: number
    width: number
    height: number
    page: number
  }) => void
  onCancel: () => void
  disabled?: boolean
}

export default function PDFSignaturePlacer({
  pdfUrl,
  signatureDataUrl,
  onConfirm,
  onCancel,
  disabled,
}: PDFSignaturePlacerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<any>(null)

  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [placement, setPlacement] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const [sigWidth, setSigWidth] = useState(150)
  const [sigHeight, setSigHeight] = useState(60)
  const [isLoading, setIsLoading] = useState(true)
  const [pdfPageWidth, setPdfPageWidth] = useState(0)
  const [pdfPageHeight, setPdfPageHeight] = useState(0)

  useEffect(() => {
    // Load PDF.js from CDN
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.async = true
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      loadPDF()
    }
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [pdfUrl])

  const loadPDF = async () => {
    try {
      const pdfjsLib = (window as any).pdfjsLib
      const loadingTask = pdfjsLib.getDocument(pdfUrl)
      const pdf = await loadingTask.promise
      pdfDocRef.current = pdf
      setTotalPages(pdf.numPages)
      setIsLoading(false)
      renderPage(0, pdf)
    } catch (error) {
      console.error('Failed to load PDF:', error)
      setIsLoading(false)
    }
  }

  const renderPage = async (pageIndex: number, pdf?: any) => {
    try {
      const doc = pdf ?? pdfDocRef.current
      if (!doc) return

      const page = await doc.getPage(pageIndex + 1)
      const viewport = page.getViewport({ scale: 1.2 })

      const canvas = canvasRef.current
      if (!canvas) return

      canvas.width = viewport.width
      canvas.height = viewport.height

      setPdfPageWidth(viewport.width)
      setPdfPageHeight(viewport.height)

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      await page.render({ canvasContext: ctx, viewport }).promise

      setCurrentPage(pageIndex)
      setPlacement(null)
    } catch (error) {
      console.error('Failed to render page:', error)
    }
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current
    if (!overlay) return

    const rect = overlay.getBoundingClientRect()
    const x = e.clientX - rect.left - sigWidth / 2
    const y = e.clientY - rect.top - sigHeight / 2

    const clampedX = Math.max(0, Math.min(x, pdfPageWidth - sigWidth))
    const clampedY = Math.max(0, Math.min(y, pdfPageHeight - sigHeight))

    setPlacement({
      x: clampedX,
      y: clampedY,
      width: sigWidth,
      height: sigHeight,
    })
  }

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSigWidth(Number(e.target.value))
    setPlacement(null)
  }

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSigHeight(Number(e.target.value))
    setPlacement(null)
  }

  const handlePrevPage = () => {
    if (currentPage > 0) {
      renderPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      renderPage(currentPage + 1)
    }
  }

  const handleConfirmPlacement = () => {
    if (!placement) return

    onConfirm({
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      page: currentPage,
    })
  }

  return (
    <div className="card">
      <h2 className="section-heading">Place Your Signature</h2>
      <p className="text-sm text-gray-500 font-poppins mb-3">
        Click on the document where you want to place your signature
      </p>

      {/* Size Controls */}
      <div className="flex gap-4 items-center mb-3">
        <span className="text-sm font-poppins text-college-accent">Signature Size:</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={80}
            max={300}
            value={sigWidth}
            onChange={handleWidthChange}
            className="w-32"
            disabled={disabled}
          />
          <span className="text-xs text-gray-500 font-poppins w-16">W: {sigWidth}px</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={30}
            max={120}
            value={sigHeight}
            onChange={handleHeightChange}
            className="w-32"
            disabled={disabled}
          />
          <span className="text-xs text-gray-500 font-poppins w-16">H: {sigHeight}px</span>
        </div>
      </div>

      {/* Page Navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 0 || disabled}
            className="btn-secondary text-sm"
          >
            ← Prev
          </button>
          <span className="text-sm font-poppins text-college-text">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages - 1 || disabled}
            className="btn-secondary text-sm"
          >
            Next →
          </button>
        </div>
      )}

      {/* PDF Canvas Area */}
      {isLoading ? (
        <p className="text-college-secondary text-sm font-poppins">Loading PDF preview...</p>
      ) : (
        <div className="mb-3">
          <div style={{ position: 'relative', display: 'inline-block', cursor: 'crosshair' }}>
            <canvas
              ref={canvasRef}
              style={{ display: 'block', maxWidth: '100%' }}
            />
            <div
              ref={overlayRef}
              onClick={handleCanvasClick}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                cursor: 'crosshair',
              }}
            />
            {placement && (
              <div
                style={{
                  position: 'absolute',
                  left: placement.x + 'px',
                  top: placement.y + 'px',
                  width: placement.width + 'px',
                  height: placement.height + 'px',
                  border: '2px dashed #C06121',
                  pointerEvents: 'none',
                  background: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                <img
                  src={signatureDataUrl}
                  alt="Signature preview"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Message */}
      {placement && (
        <p className="text-green-600 text-sm font-poppins mt-2">
          ✓ Signature placement selected
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 mt-4">
        <button onClick={onCancel} disabled={disabled} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={handleConfirmPlacement}
          disabled={!placement || disabled}
          className="btn-primary"
        >
          Confirm Placement
        </button>
      </div>
    </div>
  )
}

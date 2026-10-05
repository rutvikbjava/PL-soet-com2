'use client'

import { useRef, useState, useEffect } from 'react'

interface SignaturePadProps {
  onSave: (dataUrl: string) => void
  disabled?: boolean
}

export default function SignaturePad({ onSave, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const isEmptyRef = useRef(true)

  const [activeTab, setActiveTab] = useState<'draw' | 'upload'>('draw')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [canSave, setCanSave] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw placeholder
    if (isEmptyRef.current) {
      ctx.fillStyle = '#d1d5db'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Sign here', canvas.width / 2, canvas.height / 2)
    }
  }, [activeTab])

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw placeholder
    ctx.fillStyle = '#d1d5db'
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Sign here', canvas.width / 2, canvas.height / 2)

    isEmptyRef.current = true
    setCanSave(false)
    setIsSaved(false)
  }

  const startDrawing = (x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas || disabled) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear placeholder on first draw
    if (isEmptyRef.current) {
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      isEmptyRef.current = false
    }

    isDrawingRef.current = true
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (x: number, y: number) => {
    if (!isDrawingRef.current) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.strokeStyle = 'black'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineTo(x, y)
    ctx.stroke()

    setCanSave(true)
    setIsSaved(false)
  }

  const stopDrawing = () => {
    isDrawingRef.current = false
  }

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    startDrawing(x, y)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    draw(x, y)
  }

  const handleMouseUp = () => {
    stopDrawing()
  }

  const handleMouseLeave = () => {
    stopDrawing()
  }

  // Touch events
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top
    startDrawing(x, y)
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top
    draw(x, y)
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    stopDrawing()
  }

  const handleSaveDrawn = () => {
    const canvas = canvasRef.current
    if (!canvas || isEmptyRef.current || disabled) return

    const dataUrl = canvas.toDataURL('image/png')
    onSave(dataUrl)
    setIsSaved(true)
  }

  // Upload tab handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadedFile(file)

    // Create preview URL
    const reader = new FileReader()
    reader.onload = () => {
      setUploadedPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUploadSave = () => {
    if (!uploadedFile) return

    const reader = new FileReader()
    reader.onload = () => {
      onSave(reader.result as string)
      setIsSaved(true)
    }
    reader.readAsDataURL(uploadedFile)
  }

  const handleChooseDifferent = () => {
    setUploadedFile(null)
    setUploadedPreviewUrl(null)
    setIsSaved(false)
  }

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('draw')}
          className={
            activeTab === 'draw'
              ? 'bg-college-secondary text-white px-4 py-2 rounded-t-lg text-sm font-poppins font-semibold'
              : 'bg-white border border-college-peach text-college-text px-4 py-2 rounded-t-lg text-sm font-poppins cursor-pointer'
          }
        >
          Draw Signature
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={
            activeTab === 'upload'
              ? 'bg-college-secondary text-white px-4 py-2 rounded-t-lg text-sm font-poppins font-semibold'
              : 'bg-white border border-college-peach text-college-text px-4 py-2 rounded-t-lg text-sm font-poppins cursor-pointer'
          }
        >
          Upload Signature
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'draw' && (
        <div>
          <canvas
            ref={canvasRef}
            width={500}
            height={160}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="border border-college-peach rounded-lg cursor-crosshair touch-none"
            style={{ touchAction: 'none' }}
          />

          <div className="flex gap-3 mt-4">
            <button
              onClick={clearCanvas}
              disabled={disabled}
              className="btn-secondary"
            >
              Clear
            </button>
            <button
              onClick={handleSaveDrawn}
              disabled={disabled || !canSave || isEmptyRef.current}
              className="btn-primary"
            >
              Save Signature
            </button>
            {isSaved && (
              <span className="text-green-600 font-poppins text-sm flex items-center">
                Signature Saved ✓
              </span>
            )}
          </div>
        </div>
      )}

      {activeTab === 'upload' && (
        <div>
          {!uploadedFile ? (
            <div>
              <label
                htmlFor="signature-upload"
                className="block border-2 border-dashed border-college-peach rounded-lg p-8 text-center cursor-pointer bg-college-bg hover:bg-white transition"
              >
                <p className="text-college-text font-poppins">
                  Click to upload signature image
                </p>
                <p className="text-xs text-gray-400 mt-1 font-poppins">
                  PNG or JPG, transparent background recommended
                </p>
              </label>
              <input
                id="signature-upload"
                type="file"
                accept=".png,.jpg,.jpeg"
                onChange={handleFileSelect}
                disabled={disabled}
                className="hidden"
              />
            </div>
          ) : (
            <div>
              {uploadedPreviewUrl && (
                <div className="mb-4">
                  <img
                    src={uploadedPreviewUrl}
                    alt="Signature preview"
                    className="max-h-[120px] border border-college-peach rounded p-2 object-contain mx-auto"
                  />
                  <p className="text-xs text-gray-500 text-center mt-2 font-poppins">
                    {uploadedFile.name}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleUploadSave}
                  disabled={disabled}
                  className="btn-primary"
                >
                  Use This Signature
                </button>
                <button
                  onClick={handleChooseDifferent}
                  disabled={disabled}
                  className="btn-secondary text-sm"
                >
                  Choose Different
                </button>
                {isSaved && (
                  <span className="text-green-600 font-poppins text-sm flex items-center">
                    Signature Saved ✓
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

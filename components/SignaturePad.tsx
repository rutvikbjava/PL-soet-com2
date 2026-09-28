'use client'

import { useRef, useState, useEffect } from 'react'

interface SignaturePadProps {
  onSave: (dataUrl: string) => void
  disabled?: boolean
}

export default function SignaturePad({ onSave, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const isEmpty = useRef(true)
  const [isSaved, setIsSaved] = useState(false)
  const [canSave, setCanSave] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    drawPlaceholder()
  }, [])

  const drawPlaceholder = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#d1d5db'
    ctx.font = '16px Poppins, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Sign here', canvas.width / 2, canvas.height / 2)
  }

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    if (e instanceof TouchEvent) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    }
    return {
      x: (e as MouseEvent).clientX - rect.left,
      y: (e as MouseEvent).clientY - rect.top
    }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (isEmpty.current) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      isEmpty.current = false
      setCanSave(false)
      setIsSaved(false)
    }

    isDrawing.current = true

    const pos = getPos(e.nativeEvent, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || disabled) return
    e.preventDefault()

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pos = getPos(e.nativeEvent, canvas)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#000000'
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const stopDraw = () => {
    if (isDrawing.current) {
      isDrawing.current = false
      if (!isEmpty.current) {
        setCanSave(true)
      }
    }
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    isEmpty.current = true
    setCanSave(false)
    setIsSaved(false)
    drawPlaceholder()
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas || isEmpty.current) return

    const dataUrl = canvas.toDataURL('image/png')
    onSave(dataUrl)
    setIsSaved(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        width={500}
        height={160}
        className="border-2 border-college-peach rounded-lg cursor-crosshair touch-none"
        style={{ background: '#ffffff', maxWidth: '100%' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleClear}
          className="btn-secondary text-sm px-4 py-2"
        >
          Clear
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || disabled}
          className="btn-primary text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaved ? 'Signature Saved ✓' : 'Save Signature'}
        </button>
      </div>

      {isSaved && (
        <p className="text-green-600 text-xs font-poppins">
          Signature saved. Click Approve with Signature to proceed.
        </p>
      )}
    </div>
  )
}

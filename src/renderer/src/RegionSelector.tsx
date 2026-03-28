import React, { useCallback, useEffect, useRef, useState } from 'react'

interface Point {
  x: number
  y: number
}

interface Region {
  x: number
  y: number
  width: number
  height: number
}

function computeRegion(start: Point, end: Point): Region {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  }
}

export default function RegionSelector(): React.JSX.Element {
  const [isDragging, setIsDragging] = useState(false)
  const [start, setStart] = useState<Point | null>(null)
  const [current, setCurrent] = useState<Point | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const region = start && current ? computeRegion(start, current) : null

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setStart({ x: e.clientX, y: e.clientY })
    setCurrent({ x: e.clientX, y: e.clientY })
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return
      setCurrent({ x: e.clientX, y: e.clientY })
    },
    [isDragging]
  )

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !start) return
      setIsDragging(false)

      const finalRegion = computeRegion(start, { x: e.clientX, y: e.clientY })
      if (finalRegion.width < 10 || finalRegion.height < 10) {
        // Too small — cancel
        window.api.cancelRegionSelect()
        return
      }

      window.api.confirmRegionSelect(finalRegion)
    },
    [isDragging, start]
  )

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      window.api.cancelRegionSelect()
    }
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleMouseMove, handleMouseUp, handleKeyDown])

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        inset: 0,
        cursor: isDragging ? 'crosshair' : 'crosshair',
        userSelect: 'none',
        WebkitAppRegion: 'no-drag'
      } as React.CSSProperties}
    >
      {/* Dim overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.35)'
        }}
      />

      {/* Instructions */}
      {!isDragging && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 8,
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.75)',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 8,
              fontSize: 16,
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 500
            }}
          >
            Drag to select the game grid region
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: 13,
              fontFamily: 'system-ui, sans-serif'
            }}
          >
            Press Esc to cancel
          </div>
        </div>
      )}

      {/* Selection rectangle */}
      {region && region.width > 2 && region.height > 2 && (
        <>
          {/* Cut-out: show the original content through the selection */}
          <div
            style={{
              position: 'absolute',
              left: region.x,
              top: region.y,
              width: region.width,
              height: region.height,
              background: 'transparent',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
              border: '2px dashed rgba(124, 106, 247, 0.9)',
              borderRadius: 2,
              pointerEvents: 'none'
            }}
          />
          {/* Dimension label */}
          <div
            style={{
              position: 'absolute',
              left: region.x,
              top: region.y + region.height + 6,
              background: 'rgba(124, 106, 247, 0.9)',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'monospace',
              pointerEvents: 'none',
              whiteSpace: 'nowrap'
            }}
          >
            {region.width} × {region.height}
          </div>
        </>
      )}
    </div>
  )
}

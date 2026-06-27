import React, { useEffect, useRef, useCallback } from 'react'

const gridSize = 20

const GridBackgroundCanvas: React.FC = (props: any) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const drawGrid = useCallback((context: CanvasRenderingContext2D, width: number, height: number) => {
    context.clearRect(0, 0, width, height)

    for (let x = 0; x <= width; x += gridSize) {
      for (let y = 0; y <= height; y += gridSize) {
        if ((x / gridSize) % 2 === (y / gridSize) % 2) {
          context.fillStyle = 'rgba(200, 200, 200, 0.5)'
        } else {
          context.fillStyle = 'rgba(255, 255, 255, 0.5)'
        }
        context.fillRect(x, y, gridSize, gridSize)
      }
    }
  }, [])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const container = canvas.parentElement as HTMLElement
      const containerStyle = getComputedStyle(container)
      const width = parseFloat(containerStyle.width)
      const height = parseFloat(containerStyle.height)
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (context) {
        drawGrid(context, width, height)
      }
    }
  }, [drawGrid])

  useEffect(() => {
    window.addEventListener('resize', resizeCanvas)
    resizeCanvas()
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [resizeCanvas])

  return (
    <div
      className="canvas-background-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        flexGrow: '1',
        width: '100%',
        height: '100%',
        background: '#fff',
        display: 'flex',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }}></canvas>
    </div>
  )
}

export default GridBackgroundCanvas

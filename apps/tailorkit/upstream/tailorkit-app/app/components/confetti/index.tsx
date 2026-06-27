import { useEffect, useMemo, useRef } from 'react'
import { CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX } from '../ChatBotDrawer/constants'

interface IConfettiEffectProps {
  /** Duration of animation in milliseconds. Default is 3000 ms */
  duration?: number
  /** Colors of confetti. Each confetti will be randomly chosen from this list */
  colors?: string[]
  /** Number of particles per burst from each side. Default is 50 */
  particleCount?: number
  /** Gravity effect on particles. Default is 0.15 */
  gravity?: number
  /** Initial velocity multiplier. Default is 0.7 */
  initialVelocity?: number
  /** Spread angle in degrees. Default is 25 */
  spread?: number
  /** Starting angle in degrees. For left side: 45 + spread, for right side: 105 + spread */
  startAngle?: number
  /** Particle size range. Default is { min: 10, max: 20 } */
  size?: {
    min: number
    max: number
  }
  /** Rotation speed multiplier. Default is 0.6 */
  rotationSpeed?: number
  /** Opacity decay rate. Higher values make particles fade faster. Default is 0.001 */
  opacityDecay?: number
  /** Z-index of the canvas. Default is 999999 */
  zIndex?: number
  /** Whether to start animation immediately. Default is true */
  autoStart?: boolean
  /** Shape of particles. Default is random mix of all shapes */
  shape?: 'square' | 'circle' | 'triangle' | 'ribbon'
  /** Ticks per frame. Controls how often particles update. Default is 1 */
  ticks?: number
  /** Origin points for confetti. Default is ['left', 'right'] */
  origins?: ('left' | 'right' | 'center')[]
}

interface Particle {
  x: number
  y: number
  rotation: number
  color: string
  size: number
  velocity: {
    x: number
    y: number
  }
  rotationSpeed: number
  gravity: number
  opacity: number
  shape: 'square' | 'circle' | 'triangle' | 'ribbon'
  ribbonAngle?: number
  ribbonWidth?: number
  ribbonLength?: number
  ribbonWaveFreq?: number
  ribbonWaveAmp?: number
  ribbonPhase?: number
}

const DEFAULT_COLORS = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']

const DEFAULT_PROPS: Required<IConfettiEffectProps> = {
  duration: 3000,
  colors: DEFAULT_COLORS,
  particleCount: 150,
  gravity: 0.15,
  initialVelocity: 0.7,
  spread: 25,
  startAngle: 45,
  size: {
    min: 8,
    max: 20,
  },
  rotationSpeed: 0.6,
  opacityDecay: 0.001,
  zIndex: CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX,
  autoStart: true,
  shape: 'square', // This won't be used directly as we'll randomize shapes
  ticks: 1,
  origins: ['left', 'right'],
}

// Helper function to get random shape
const getRandomShape = (): 'square' | 'circle' | 'triangle' | 'ribbon' => {
  const shapes: ('square' | 'circle' | 'triangle' | 'ribbon')[] = ['square', 'circle', 'triangle', 'ribbon']
  return shapes[Math.floor(Math.random() * shapes.length)]
}

const ConfettiEffect = (props: IConfettiEffectProps) => {
  const options = useMemo(() => ({ ...DEFAULT_PROPS, ...props }), [props])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationFrameRef = useRef<number>()
  const tickCountRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match window size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Create particles from specified origins
    const createParticles = () => {
      const particles: Particle[] = []

      options.origins.forEach(origin => {
        let x = 0
        let baseAngle = options.startAngle

        if (origin === 'right') {
          x = canvas.width
          baseAngle = 180 - options.startAngle
        } else if (origin === 'center') {
          x = canvas.width / 2
          baseAngle = Math.random() * 360
        }

        for (let i = 0; i < options.particleCount; i++) {
          particles.push(createParticle(x, baseAngle))
        }
      })

      return particles
    }

    // Create a single particle
    const createParticle = (x: number, baseAngle: number): Particle => {
      const angle = ((Math.random() * options.spread * 2 - options.spread + baseAngle) * Math.PI) / 180
      const speed = (Math.random() * 15 + 15) * options.initialVelocity
      const shape = getRandomShape()
      const size = Math.random() * (options.size.max - options.size.min) + options.size.min

      const particle: Particle = {
        x,
        y: canvas.height,
        rotation: Math.random() * 360,
        color: options.colors[Math.floor(Math.random() * options.colors.length)],
        size,
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed * -1,
        },
        rotationSpeed: (Math.random() - 0.5) * 0.2 * options.rotationSpeed,
        gravity: options.gravity,
        opacity: 1,
        shape,
      }

      // Add ribbon-specific properties if shape is ribbon
      if (shape === 'ribbon') {
        particle.ribbonAngle = Math.random() * Math.PI * 2
        particle.ribbonWidth = size * 0.2
        particle.ribbonLength = size * 4
        particle.ribbonWaveFreq = 1.5 + Math.random() * 2
        particle.ribbonWaveAmp = size * (0.3 + Math.random() * 0.2)
        particle.ribbonPhase = Math.random() * Math.PI * 2
      }

      return particle
    }

    let startTime: number | null = null
    let isCleaningUp = false

    // Update and draw particles
    const animate = (timestamp: number) => {
      if (!ctx || !canvas) return
      if (!startTime) startTime = timestamp

      const elapsedTime = timestamp - startTime
      const timeLeft = options.duration - elapsedTime

      tickCountRef.current++

      if (tickCountRef.current % options.ticks === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        particlesRef.current.forEach(particle => {
          // Update particle position
          particle.x += particle.velocity.x
          particle.y += particle.velocity.y
          particle.velocity.y += particle.gravity
          particle.rotation += particle.rotationSpeed

          // If we're in cleanup mode, make particles fade faster
          const decayRate = isCleaningUp ? options.opacityDecay * 3 : options.opacityDecay
          particle.opacity = Math.max(0, particle.opacity - decayRate)

          // Draw particle based on shape
          ctx.save()
          ctx.translate(particle.x, particle.y)
          ctx.rotate(particle.rotation)
          ctx.globalAlpha = particle.opacity
          ctx.fillStyle = particle.color

          switch (particle.shape) {
            case 'circle':
              ctx.beginPath()
              ctx.arc(0, 0, particle.size / 2, 0, Math.PI * 2)
              ctx.fill()
              break

            case 'triangle':
              ctx.beginPath()
              ctx.moveTo(-particle.size / 2, particle.size / 2)
              ctx.lineTo(particle.size / 2, particle.size / 2)
              ctx.lineTo(0, -particle.size / 2)
              ctx.closePath()
              ctx.fill()
              break

            case 'ribbon':
              if (
                particle.ribbonWidth
                && particle.ribbonLength
                && particle.ribbonWaveFreq
                && particle.ribbonWaveAmp
                && particle.ribbonPhase !== undefined
              ) {
                ctx.beginPath()

                // Draw a more complex curved ribbon
                const points = 20 // Number of points to create smooth curve
                const path: [number, number][] = []

                // Generate points for the curve
                for (let i = 0; i <= points; i++) {
                  const t = i / points
                  const x = particle.ribbonLength * t
                  const phase = particle.ribbonPhase + particle.rotation / 30
                  const waveY = Math.sin(t * Math.PI * particle.ribbonWaveFreq + phase) * particle.ribbonWaveAmp
                  path.push([x, waveY])
                }

                // Draw the ribbon using multiple bezier curves
                ctx.moveTo(0, 0)
                for (let i = 0; i < path.length - 3; i += 3) {
                  const cp1 = path[i + 1]
                  const cp2 = path[i + 2]
                  const end = path[i + 3]
                  ctx.bezierCurveTo(cp1[0], cp1[1], cp2[0], cp2[1], end[0], end[1])
                }

                ctx.lineWidth = particle.ribbonWidth
                ctx.lineCap = 'round'
                ctx.strokeStyle = particle.color
                ctx.stroke()

                // Add a highlight effect
                ctx.globalAlpha = particle.opacity * 0.5
                ctx.lineWidth = particle.ribbonWidth * 0.5
                ctx.stroke()
              }
              break

            default: // square
              ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size)
          }

          ctx.restore()
        })

        // Remove particles that are out of view or fully transparent
        particlesRef.current = particlesRef.current.filter(
          particle =>
            particle.opacity > 0
            && particle.x > -100
            && particle.x < canvas.width + 100
            && particle.y < canvas.height + 100
        )
      }

      // Start cleanup when duration is about to end
      if (timeLeft <= 500 && !isCleaningUp) {
        isCleaningUp = true
      }

      // Continue animation only if there are particles and within time limit
      if (particlesRef.current.length > 0 && timeLeft > -500) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        // Final cleanup
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        particlesRef.current = []
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }

    // Start the animation if autoStart is true
    if (options.autoStart) {
      particlesRef.current = createParticles()
      animationFrameRef.current = requestAnimationFrame(animate)

      return () => {
        window.removeEventListener('resize', resizeCanvas)
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        // Final cleanup on unmount
        if (ctx && canvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        particlesRef.current = []
      }
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: options.zIndex,
      }}
    />
  )
}

export default ConfettiEffect

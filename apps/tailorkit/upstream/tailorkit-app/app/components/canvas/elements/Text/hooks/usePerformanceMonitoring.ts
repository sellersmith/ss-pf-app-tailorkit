import { useEffect } from 'react'

interface PerformanceMonitoringOptions {
  componentName: string
  componentId: string
  enabled?: boolean
  threshold?: number
  onPerformanceWarning?: (duration: number, componentId: string) => void
}

/**
 * Custom hook for performance monitoring
 * Tracks component render performance and provides warnings when thresholds are exceeded
 */
export function usePerformanceMonitoring({
  componentName,
  componentId,
  enabled = process.env.NODE_ENV === 'development',
  threshold = 16, // 1 frame at 60fps
  onPerformanceWarning,
}: PerformanceMonitoringOptions) {
  useEffect(() => {
    if (!enabled) return

    const perfMark = `${componentName}-${componentId}-render`
    performance.mark(`${perfMark}-start`)

    return () => {
      try {
        performance.mark(`${perfMark}-end`)
        performance.measure(perfMark, `${perfMark}-start`, `${perfMark}-end`)

        // Check performance and log warnings if threshold exceeded
        const measures = performance.getEntriesByName(perfMark)
        const measure = measures[measures.length - 1] // Get the latest measure

        if (measure && measure.duration > threshold) {
          const warningMessage = `${componentName} performance warning: ${measure.duration.toFixed(2)}ms render time for component ${componentId}`

          if (onPerformanceWarning) {
            onPerformanceWarning(measure.duration, componentId)
          } else {
            console.warn(warningMessage)
          }
        }

        // Clean up old performance entries to prevent memory leaks
        performance.clearMeasures(perfMark)
        performance.clearMarks(`${perfMark}-start`)
        performance.clearMarks(`${perfMark}-end`)
      } catch (error) {
        // Silently handle performance measurement errors
        // This can happen when component unmounts before mark-start is created,
        // or when layers are deleted during multi-layout operations
      }
    }
  }, [componentName, componentId, enabled, threshold, onPerformanceWarning])
}

/**
 * Higher-order hook for measuring specific operations
 */
export function useOperationPerformance(operationName: string, enabled = process.env.NODE_ENV === 'development') {
  const measureOperation = (operation: () => void | Promise<void>) => {
    if (!enabled) {
      return operation()
    }

    const markName = `operation-${operationName}-${Date.now()}`
    performance.mark(`${markName}-start`)

    const result = operation()

    // Handle both sync and async operations
    if (result instanceof Promise) {
      return result.finally(() => {
        try {
          performance.mark(`${markName}-end`)
          performance.measure(markName, `${markName}-start`, `${markName}-end`)

          const measure = performance.getEntriesByName(markName)[0]
          if (measure && measure.duration > 10) {
            console.log(`Operation ${operationName} took ${measure.duration.toFixed(2)}ms`)
          }

          // Cleanup
          performance.clearMeasures(markName)
          performance.clearMarks(`${markName}-start`)
          performance.clearMarks(`${markName}-end`)
        } catch (error) {
          // Silently handle performance measurement errors
        }
      })
    }

    try {
      performance.mark(`${markName}-end`)
      performance.measure(markName, `${markName}-start`, `${markName}-end`)

      const measure = performance.getEntriesByName(markName)[0]
      if (measure && measure.duration > 10) {
        console.log(`Operation ${operationName} took ${measure.duration.toFixed(2)}ms`)
      }

      // Cleanup
      performance.clearMeasures(markName)
      performance.clearMarks(`${markName}-start`)
      performance.clearMarks(`${markName}-end`)
    } catch (error) {
      // Silently handle performance measurement errors
    }

    return result
  }

  return measureOperation
}

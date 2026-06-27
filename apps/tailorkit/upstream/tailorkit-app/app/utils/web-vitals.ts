/**
 * Get browser info
 * @returns
 */
export const getBrowserInfo = () => {
  const ua = navigator?.userAgent

  if (!ua) {
    return 'Unknown user agent'
  }

  let tem

  let M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || []

  if (/trident/i.test(M[1])) {
    tem = /\brv[ :]+(\d+)/g.exec(ua) || []
    return `IE ${tem[1] || ''}`
  }

  if (M[1] === 'Chrome') {
    tem = ua.match(/\b(OPR|Edge)\/(\d+)/)
    if (tem !== null) return tem.slice(1).join(' ').replace('OPR', 'Opera')
  }

  M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?']

  if ((tem = ua.match(/version\/(\d+)/i)) !== null) M.splice(1, 1, tem[1])

  return M.join(' ')
}

/**
 * Get viewport dimensions
 */
export const getViewportInfo = () => {
  return {
    width: window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth,
    height: window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight,
  }
}

/**
 * Get device type based on screen width
 */
export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  const width = window.innerWidth
  if (width <= 768) return 'mobile'
  if (width <= 1024) return 'tablet'
  return 'desktop'
}

/**
 * Get connection information
 */
export const getConnectionInfo = () => {
  // @ts-ignore - navigator.connection is not in all browser types
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection

  if (!connection) return undefined

  return {
    type: connection.effectiveType || connection.type,
    downlink: connection.downlink,
    rtt: connection.rtt,
    saveData: connection.saveData,
  }
}

/**
 * Get memory usage information
 */
export const getMemoryInfo = () => {
  // @ts-ignore - performance.memory is not in all browsers
  const memory = performance.memory

  if (!memory) return undefined

  return {
    memoryUsage: memory.usedJSHeapSize,
    jsHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
  }
}

/**
 * Get navigation timing information
 */
export const getNavigationTiming = () => {
  const timing = performance.timing || performance.getEntriesByType('navigation')[0]

  if (!timing) return undefined

  return {
    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
    loadComplete: timing.loadEventEnd - timing.navigationStart,
    firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
    firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
  }
}

/**
 * Get current page context information
 */
export const getPageContext = () => {
  return {
    url: window.location.href,
    pathname: window.location.pathname,
    referrer: document.referrer,
    title: document.title,
    loadTime: Date.now(),
  }
}

/**
 * Generate session ID for tracking user sessions
 */
export const generateSessionId = (): string => {
  const sessionKey = 'tlk_session_id'
  let sessionId = sessionStorage.getItem(sessionKey)

  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem(sessionKey, sessionId)
  }

  return sessionId
}

/**
 * Check if performance issues are detected
 */
export const detectPerformanceIssues = (metric: string, value: number) => {
  const thresholds = {
    LCP: { good: 2500, poor: 4000 },
    CLS: { good: 0.1, poor: 0.25 },
    FID: { good: 100, poor: 300 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 },
  }

  const threshold = thresholds[metric as keyof typeof thresholds]
  if (!threshold) return 'unknown'

  if (value <= threshold.good) return 'good'
  if (value <= threshold.poor) return 'needs-improvement'
  return 'poor'
}

/**
 * Create comprehensive web vitals payload
 */
export const createWebVitalsPayload = (metric: any) => {
  const viewport = getViewportInfo()
  const deviceType = getDeviceType()
  const connectionInfo = getConnectionInfo()
  const memoryInfo = getMemoryInfo()
  const navigationTiming = getNavigationTiming()
  const pageContext = getPageContext()
  const sessionId = generateSessionId()
  const browserInfo = getBrowserInfo()
  const performanceRating = detectPerformanceIssues(metric.name, metric.value)

  return {
    type: metric.name,
    value: metric.value,
    message: JSON.stringify(metric),
    browserInfo,
    url: pageContext.url,
    pathname: pageContext.pathname,
    sessionId,
    performanceRating,
    additionalMetrics: {
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      deviceType,
      connectionType: connectionInfo?.type,
      connectionDownlink: connectionInfo?.downlink,
      connectionRtt: connectionInfo?.rtt,
      saveData: connectionInfo?.saveData,
      memoryUsage: memoryInfo?.memoryUsage,
      jsHeapSize: memoryInfo?.jsHeapSize,
      totalJSHeapSize: memoryInfo?.totalJSHeapSize,
      domContentLoaded: navigationTiming?.domContentLoaded,
      loadComplete: navigationTiming?.loadComplete,
      firstPaint: navigationTiming?.firstPaint,
      firstContentfulPaint: navigationTiming?.firstContentfulPaint,
      referrer: pageContext.referrer,
      title: pageContext.title,
      loadTime: pageContext.loadTime,
    },
  }
}

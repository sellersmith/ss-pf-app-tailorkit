// TEMPORARY DEBUG: Catch ALL uncaught errors and log to /api/debug-error
import i18next from 'i18next'
import Backend from 'i18next-http-backend'
import i18nextOptions from './bootstrap/i18n/options'
import LanguageDetector from 'i18next-browser-languagedetector'
import { hydrateRoot } from 'react-dom/client'
import { RemixBrowser } from '@remix-run/react'
import { getInitialNamespaces } from 'remix-i18next/client'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { createWebVitalsPayload } from './utils/web-vitals'
import { unAuthPages } from './bootstrap/app-config'
import { startTransition } from 'react'

window.addEventListener('error', event => {
  const msg = `[UNCAUGHT_ERROR] ${event.message} at ${event.filename}:${event.lineno}:${event.colno}\n${event.error?.stack || 'no stack'}`
  console.error('🐛 DEBUG:', msg)
  navigator.sendBeacon?.('/api/debug-error', msg)
})
window.addEventListener('unhandledrejection', event => {
  const reason = event.reason
  const msg = `[UNHANDLED_REJECTION] ${reason?.message || String(reason)}\n${reason?.stack || 'no stack'}`
  console.error('🐛 DEBUG:', msg)
  navigator.sendBeacon?.('/api/debug-error', msg)
})

// Prevent `i18next` from being initialized more than one time.
if (!i18next.isInitialized) {
  i18next
    // Tell `i18next` to use the `react-i18next` plugin.
    .use(initReactI18next)
    // Setup a client-side language detector.
    .use(LanguageDetector)
    // Setup the backend translation loader.
    .use(Backend)
    .init({
      ...i18nextOptions,
      interpolation: {
        // Escapes passed in values to avoid XSS injection. Please see https://www.i18next.com/translation-function/interpolation#additional-options
        escapeValue: false,
      },
      backend: {
        loadPath: '/locales/{{lng}}.json',
      },
      // Detects the namespaces the routes are rendered on the server side.
      ns: getInitialNamespaces(),
      detection: {
        // Enable only `htmlTag` detection because we will detect the language on the
        // server side with `remix-i18next`. Using the `<html lang>` attribute, we can
        // pass the language detected on the server side to the client.
        order: ['htmlTag'],
        // Because we only use `htmlTag`, disable caching the language on the browser.
        caches: [],
      },
    })
    .then(() => {
      // Wrap app in the `I18nextProvider` component.
      return startTransition(() => {
        hydrateRoot(
          document,
          <I18nextProvider i18n={i18next}>
            <RemixBrowser />
          </I18nextProvider>
        )
      })
    })
}

function reportWebVitals() {
  const sendMetricToServer = (metric: any) => {
    const payload = createWebVitalsPayload(metric)
    console.log('metric', metric)

    const location = window.location.pathname
    if (unAuthPages.includes(location)) {
      return
    }

    fetch('/api/web-vitals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).catch(error => {
      console.warn('Failed to send web vitals data:', error)
    })

    // Log performance issues for debugging
    if (payload.performanceRating === 'poor') {
      console.warn(`Poor ${metric.name} performance detected:`, {
        value: metric.value,
        pathname: payload.pathname,
        deviceType: payload.additionalMetrics.deviceType,
        connectionType: payload.additionalMetrics.connectionType,
      })
    }
  }

  // Track Largest Contentful Paint
  onLCP((metric: any) => {
    sendMetricToServer(metric)
    Transmitter.trigger('lcp-recorded')
  })

  // Track Cumulative Layout Shift
  onCLS((metric: any) => {
    sendMetricToServer(metric)
  })

  // Track First Input Delay
  onFID((metric: any) => {
    sendMetricToServer(metric)
  })

  // Track First Contentful Paint
  onFCP((metric: any) => {
    sendMetricToServer(metric)
  })

  // Track Time to First Byte
  onTTFB((metric: any) => {
    sendMetricToServer(metric)
  })
}

// Initialize web vitals analyzer after app hydration
function initializeWebVitalsAnalyzer() {
  // Dynamically import the analyzer to avoid SSR issues
  import('./utils/web-vitals-analyzer').catch(error => {
    console.warn('Failed to load web vitals analyzer:', error)
  })
}

reportWebVitals()

// Initialize analyzer after a short delay to ensure React is fully hydrated
setTimeout(initializeWebVitalsAnalyzer, 1000)

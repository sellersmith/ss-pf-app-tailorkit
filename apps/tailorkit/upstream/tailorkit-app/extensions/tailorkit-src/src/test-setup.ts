// Required for testing with jsdom
declare global {
  interface Window {
    __tailorkit__: {
      performance: Record<string, any>
    }
  }
}

// Setup any global mocks or polyfills here
beforeAll(() => {
  // Mock global objects that might not be available in the test environment
  if (!window.__tailorkit__) {
    window.__tailorkit__ = {
      performance: {},
    }
  }
})

export {}

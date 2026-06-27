import Backend from 'i18next-fs-backend'
import i18n from '~/bootstrap/i18n/i18n.server'
import i18nOptions from './bootstrap/i18n/options'
import { isbot } from 'isbot'
import { resolve } from 'node:path'
import { PassThrough } from 'stream'
import { createInstance } from 'i18next'
import { RemixServer } from '@remix-run/react'
import { renderToPipeableStream } from 'react-dom/server'
import { addDocumentResponseHeaders } from './shopify/app.server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { createReadableStreamFromReadable, type EntryContext } from '@remix-run/node'

// Register fulfillment provider adapters at app startup
import '~/services/fulfillment/bootstrap.server'

const ABORT_DELAY = 5000

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  addDocumentResponseHeaders(request, responseHeaders)

  const userAgent = request.headers.get('user-agent')
  const callbackName = isbot(userAgent ?? '') ? 'onAllReady' : 'onShellReady'

  // Create a new instance of `i18next` so every request will have a unique instance and not share any state.
  const instance = createInstance()

  // Detect locale from the request in the following order:
  //
  // 1. The `lng` query param in the requested URL.
  // 2. The `i18n` cookie is sent along with the request.
  // 3. The `Accept-Language` header.
  const lng = await i18n.getLocale(request)

  // Detect the namespaces the routes about to render want to use.
  const ns = i18n.getRouteNamespaces(remixContext)

  // Init the `i18next` instance.
  await instance
    // Tell the instance to use `react-i18next`.
    .use(initReactI18next)
    // Setup the backend translation loader.
    .use(Backend)
    .init({
      // Use the same configuration as on the client side.
      ...i18nOptions,
      // The locale that is detected above.
      lng,
      // The namespaces that are detected above.
      ns,
      interpolation: {
        // Escapes passed in values to avoid XSS injection. Please see https://www.i18next.com/translation-function/interpolation#additional-options
        escapeValue: false,
      },
      backend: {
        loadPath: resolve('./public/locales/{{lng}}.json'),
      },
    })

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <I18nextProvider i18n={instance}>
        <RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />
      </I18nextProvider>,
      {
        [callbackName]: () => {
          const body = new PassThrough()
          const stream = createReadableStreamFromReadable(body)

          responseHeaders.set('Content-Type', 'text/html')

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          )

          pipe(body)
        },
        onShellError(error) {
          reject(error)
        },
        onError(error) {
          responseStatusCode = 500

          console.error(error)
        },
      }
    )

    setTimeout(abort, ABORT_DELAY)
  })
}

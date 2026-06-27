import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { getExchangeRatesToUSD } from '~/utils/exchange-rates'

/**
 * API route to provide exchange rates to the client
 * This route fetches cached exchange rates from the server and returns them as JSON
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const exchangeRates = await getExchangeRatesToUSD()

    if (!exchangeRates) {
      return json({ error: 'Failed to fetch exchange rates' }, { status: 500 })
    }

    return json(exchangeRates, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('Error in exchange rates API:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}

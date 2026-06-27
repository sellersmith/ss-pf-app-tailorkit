import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import fetch from 'node-fetch'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'

// Define user testing data source
const userTestingDataSource: string
  = 'https://script.google.com/macros/s/AKfycbzPfb1b630dFcWZ97nFu9anNoRuJBZ6UbYyWtP3gO3Ny0fKALZ7wZE2_1bcyrJrtJe7/exec'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request)

    const res: any = await fetch(userTestingDataSource).then(res => res.json())

    return json({ success: true, data: res.data || res })
  } catch (error: any) {
    return json({ success: false, message: error?.message || error })
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    await authenticate.admin(request)

    const payload = await request.json()

    const res = await fetch(userTestingDataSource, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).then(res => res.json())

    return json({ success: true, data: res })
  } catch (error: any) {
    return json({ success: false, message: error?.message || error })
  }
}

import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import View from '~/models/View.server'
import { VIEW_ACTIONS } from '~/routes/api.views/constants'
import { authenticate } from '~/shopify/app.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  // Get action from search params
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const path = searchParams.get('path')

  if (!action) {
    return json({ items: await View.find({ path, shopDomain }, 'name filters') })
  }

  // Process action
  switch (action) {
    case VIEW_ACTIONS.RENAME: {
      const oldName = searchParams.get('oldName')
      const newName = searchParams.get('newName')

      await View.updateOne({ path, shopDomain, name: oldName }, { name: newName })
      break
    }

    case VIEW_ACTIONS.DELETE: {
      const name = searchParams.get('name')

      await View.deleteOne({ path, name, shopDomain })
      break
    }
  }

  return json({ success: 1 })
}

export const action = async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  // Get action from search params
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const path = searchParams.get('path')

  // Process action
  switch (action) {
    case VIEW_ACTIONS.CREATE: {
      const filters = await request.json()
      const name = searchParams.get('name')

      await View.create({ path, name, filters, shopDomain })
      break
    }

    case VIEW_ACTIONS.UPDATE: {
      const filters = await request.json()
      const name = searchParams.get('name')

      await View.updateOne({ path, name, shopDomain }, { filters })
      break
    }
  }

  return json({ success: 1 })
}

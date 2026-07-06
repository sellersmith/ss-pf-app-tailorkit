// GET /orders — read endpoint serving BOTH copied Orders screens. The list screen mounts
// `ListTable dataSource="/api/orders"`; the detail screen's clientLoader calls
// `/api/orders?filter__id=string__eq__<id>`. Both expect a `{ items, total }` envelope. Reads already-
// captured orders from scoped app-data via the order repository — no fulfillment. The detail fast path
// additionally enriches line items with a live Shopify product snapshot + TailorKit integration lookup
// (see order-line-item-enrichment-loader.ts); the list path stays pure app-data reads.
import type { AppBackendRegisterContext } from '../../../../web/server/src/app-platform/contracts'
import { TAILORKIT_CAPABILITIES } from '../domain/capabilities'
import {
  createTailorKitOrderListRow,
  parseTailorKitOrderIdFilter,
  parseTailorKitOrderListOptions,
} from '../domain/orders-list-adapter'
import { loadEnrichedTailorKitOrderLineItems } from './order-line-item-enrichment-loader'
import { createTailorKitOrderRepository } from './order-repository'

export function registerTailorKitOrdersApi(app: AppBackendRegisterContext) {
  app.api.route({
    method: 'GET',
    path: '/orders',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      const repo = createTailorKitOrderRepository(app.ports, request.context)

      // Detail-screen fast path: `filter__id=string__eq__<id>` → single record by id. Enriches line
      // items with a Shopify product snapshot + TailorKit integration (bug #5-C) — skipped on the list
      // path below since it fans out to Shopify + app-data per line item.
      const idFilter = parseTailorKitOrderIdFilter(request.query)
      if (idFilter) {
        const record = await repo.getById(idFilter)
        if (!record) return { body: { items: [], total: 0 } }
        const line_items = await loadEnrichedTailorKitOrderLineItems(app.ports, request.context, record.line_items)
        return { body: { items: [createTailorKitOrderListRow({ ...record, line_items })], total: 1 } }
      }

      const options = parseTailorKitOrderListOptions(request.query)
      const result = await repo.list(options)
      return {
        body: {
          items: result.items.map(createTailorKitOrderListRow),
          total: result.total,
        },
      }
    },
  })

  // Saved ListTable filter "views" (custom tabs). Every copied ListTable mount (PP + Orders) fetches this
  // on load. PageFly does not persist custom views, so return an empty list — ListTable then renders only
  // its default "All" tab. Registered here because the Orders work introduced the bridge entry; it serves
  // both list screens.
  app.api.route({
    method: 'GET',
    path: '/views',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler() {
      return { body: { items: [] } }
    },
  })
}

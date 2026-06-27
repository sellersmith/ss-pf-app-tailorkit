/**
 * Bootstrap file -- imports and registers all fulfillment provider adapters.
 * Import this file once at app startup (e.g., from entry.server.ts or bootstrap chain).
 */
import { registerProvider } from './registry.server'
import { ShineOnAdapter } from './adapters/shineon-adapter.server'
import { PrintifyAdapter } from './adapters/printify-adapter.server'
import { PrintWayAdapter } from './adapters/printway-adapter.server'

registerProvider(new ShineOnAdapter())
registerProvider(new PrintifyAdapter())
registerProvider(new PrintWayAdapter())

// Minimal AppBackendPorts for the migration write path. repo.update only touches ports.appData; every
// other port is a throwing proxy so an accidental Shopify side-effect (publish/metafield/credit) fails
// LOUDLY instead of silently hitting Shopify during a data-only migration.
import type { AppBackendPorts, ScopedAppDataPort } from '../../../../../web/server/src/app-platform/contracts'

function throwingPort(name: string): never {
  throw new Error(`[tailorkit-migration] port "${name}" is not available in the data-only migration runner`)
}

export function createMinimalMigrationPorts(appData: ScopedAppDataPort): AppBackendPorts {
  const guard = (portName: string) =>
    new Proxy(
      {},
      {
        get: () => () => throwingPort(portName),
      }
    )

  return {
    appData,
    appAccess: guard('appAccess'),
    shopContext: guard('shopContext'),
    appSecrets: guard('appSecrets'),
    surfaceActivations: guard('surfaceActivations'),
    appMetafields: guard('appMetafields'),
    publishOperations: guard('publishOperations'),
    publishOperationLocks: guard('publishOperationLocks'),
    lifecycleTransitions: guard('lifecycleTransitions'),
    hookExecutions: guard('hookExecutions'),
    webhookIntentQueue: guard('webhookIntentQueue'),
    shopifyWebhookSubscriptions: guard('shopifyWebhookSubscriptions'),
    shopifyResources: guard('shopifyResources'),
    shopifyTheme: guard('shopifyTheme'),
    supportDebug: guard('supportDebug'),
    supportDebugAudits: guard('supportDebugAudits'),
    tracking: guard('tracking'),
    ai: guard('ai'),
  } as AppBackendPorts
}

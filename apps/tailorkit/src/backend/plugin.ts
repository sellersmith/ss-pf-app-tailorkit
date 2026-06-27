import type { AppBackendPlugin } from '../../../../web/server/src/app-platform/contracts'
import { tailorkitManifest } from '../../manifest'
import { registerTailorKitAIPromptHelperApi } from './ai-prompt-helper-api'
import { registerTailorKitPreferencesApi } from './preferences-api'
import { registerTailorKitOrderWebhookIntent } from './order-webhook-intent'
import { registerTailorKitOrdersApi } from './orders-list-api'
import { registerTailorKitProductPersonalizerApi } from './product-personalizer-api'
import { registerTailorKitStatusApi } from './status-api'
import { registerTailorKitStorefrontSetupApi } from './storefront-setup-api'
import { registerTailorKitStorefrontProxyApi } from './storefront-proxy-api'
import { createTailorKitStorefrontActivationMetafields } from './storefront-styling-publisher'
import { tailorkitStorefrontContribution } from './storefront-runtime-contract'
import { registerTailorKitThemeConfigApi } from './theme-config-api'

export const tailorkitBackendPlugin: AppBackendPlugin = {
  appId: tailorkitManifest.appId,
  manifest: tailorkitManifest,
  register(ctx) {
    registerTailorKitProductPersonalizerApi(ctx)
    registerTailorKitOrdersApi(ctx)
    registerTailorKitPreferencesApi(ctx)
    registerTailorKitStorefrontSetupApi(ctx)
    registerTailorKitStatusApi(ctx)
    registerTailorKitThemeConfigApi(ctx)
    registerTailorKitAIPromptHelperApi(ctx)
    registerTailorKitStorefrontProxyApi(ctx)
    registerTailorKitOrderWebhookIntent(ctx)

    // Storefront runtime: on merchant activation the host publishes the Storefront API token (under the
    // `em_storefront` override) plus the global-styling snapshot the copied storefront Liquid reads.
    ctx.storefront.runtime({
      name: tailorkitStorefrontContribution.name,
      assetPath: tailorkitStorefrontContribution.assetPath,
      configElementId: tailorkitStorefrontContribution.configElementId,
      globalStoreKey: tailorkitStorefrontContribution.globalStoreKey,
      storefrontAccessTokenNamespace: tailorkitStorefrontContribution.storefrontAccessTokenNamespace,
      contribution: 'active',
      activationMetafields: ({ context, ports }) => createTailorKitStorefrontActivationMetafields(ports, context),
    })
  },
}

export default tailorkitBackendPlugin

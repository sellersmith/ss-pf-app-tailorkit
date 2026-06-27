export type ProductEditorIslandAliasStatus = 'active-adapter' | 'upstream-copy' | 'pending-copy' | 'blocked'
export type ProductEditorIslandImportBoundaryStatus =
  | 'active-adapter'
  | 'upstream-reference-only'
  | 'requires-pagefly-facade'
  | 'type-only-reference'

export interface ProductEditorIslandAliasContract {
  source: string
  target: string
  status: ProductEditorIslandAliasStatus
  notes: string
}

export interface ProductEditorIslandImportBoundaryContract {
  source: string
  status: ProductEditorIslandImportBoundaryStatus
  examples: readonly string[]
  notes: string
}

export const productEditorIslandAliasContracts = [
  {
    source: '@remix-run/react',
    target: 'apps/tailorkit/src/admin/product-editor-island/pagefly-remix-react-shim.tsx',
    status: 'active-adapter',
    notes: 'PageFly admin runs on React Router, so Remix hooks are shimmed at the island boundary.',
  },
  {
    source: '~/shopify/fns.client',
    target: 'apps/tailorkit/src/admin/product-editor-island/pagefly-authenticated-fetch-shim.ts',
    status: 'active-adapter',
    notes: 'TailorKit authenticatedFetch is narrowed to PageFly app-scoped API routes.',
  },
  {
    source: '~/utils/shopify',
    target: 'apps/tailorkit/src/admin/product-editor-island/pagefly-shopify-shim.ts',
    status: 'active-adapter',
    notes:
      'TailorKit save-bar helpers read/write PageFly-owned Shopify App Bridge global through a narrow admin adapter.',
  },
  {
    source: '~/utils/toastEvents',
    target: 'apps/tailorkit/src/admin/product-editor-island/pagefly-toast-events-shim.ts',
    status: 'active-adapter',
    notes:
      'Copied TailorKit toast calls use Shopify App Bridge when available and fall back to the PageFly admin notification port.',
  },
  {
    source: '~/bootstrap/hooks/useNavigateAppBridge',
    target: 'apps/tailorkit/src/admin/product-editor-island/pagefly-navigate-app-bridge-shim.tsx',
    status: 'active-adapter',
    notes:
      'Copied TailorKit header/back/post-publish navigation keeps save-bar leave confirmation while routing through PageFly admin navigation.',
  },
  {
    source: '~/utils/hooks/useLiveChat, ~/bootstrap/hoc/withCrispChat, and crisp-sdk-web',
    target: 'apps/tailorkit/src/admin/product-editor-island/pagefly-live-chat-shim.ts',
    status: 'active-adapter',
    notes: 'TailorKit support-chat/Crisp calls are disabled no-op adapters inside PageFly admin; PageFly does not bundle the Crisp SDK.',
  },
  {
    source: '~/modules/InteractiveChat/withInteractiveChat',
    target: 'apps/tailorkit/src/admin/product-editor-island/pagefly-interactive-chat-shim.tsx',
    status: 'active-adapter',
    notes: 'TailorKit InteractiveChat and reward-coupon follow-up APIs are disabled in PageFly admin; PageFly owns support/chat surfaces.',
  },
  {
    source: '~/providers/ChatBotContext',
    target: 'apps/tailorkit/src/admin/product-editor-island/pagefly-chatbot-context-shim.tsx',
    status: 'active-adapter',
    notes:
      'Copied ProductEditor reads useChatBot() layout flags only; PageFly admin reports a closed no-op chat because it does not bundle the TailorKit AI assistant stack.',
  },
  {
    source:
      '~/bootstrap/hoc/withNavMenu, ~/bootstrap/hoc/withFeedback, ~/bootstrap/hoc/withTourGuide, and ~/modules/IdleTimeTracker/withIdleTracker',
    target: 'apps/tailorkit/src/admin/product-editor-island/pagefly-route-behavior-shim.tsx',
    status: 'active-adapter',
    notes:
      'TailorKit route-level nav, pricing redirect, feedback, tour-guide, and idle support wrappers are disabled in PageFly admin; Product Personalizer V0.1 keeps only core listing/detail/save/publish flow.',
  },
  {
    source: '~/modules/Feedback/hooks/useGatherUserFeedbackForm',
    target: 'apps/tailorkit/src/admin/product-editor-island/pagefly-feedback-shim.ts',
    status: 'active-adapter',
    notes:
      'TailorKit feedback/user-journey prompts after save/publish are disabled in PageFly admin until PageFly owns those surfaces.',
  },
  {
    source: '~/root',
    target: 'apps/tailorkit/src/admin/product-editor-island/pagefly-root-shim.ts',
    status: 'active-adapter',
    notes: 'TailorKit root-loader reads are provided by PageFly island loader context instead of Remix server root.',
  },
  {
    source: '~/routes/dashboard/route',
    target: 'apps/tailorkit/src/admin/product-editor-island/facades/app/routes/dashboard/route.tsx',
    status: 'active-adapter',
    notes: 'Only HydrateFallback is needed by copied ProductEditor routes; dashboard loader/server auth stays out of admin bundles.',
  },
  {
    source: '~/',
    target: 'apps/tailorkit/upstream/tailorkit-app/app/',
    status: 'upstream-copy',
    notes: 'TailorKit app-root imports resolve to copied upstream source, not PageFly core modules.',
  },
  {
    source: 'extensions/tailorkit-src/',
    target: 'apps/tailorkit/upstream/tailorkit-app/extensions/tailorkit-src/',
    status: 'upstream-copy',
    notes: 'Shared TailorKit canvas utilities are copied under the island and stay out of PageFly core/OneTick.',
  },
  {
    source: '~/models/',
    target: 'PageFly app-platform API facades',
    status: 'blocked',
    notes: 'Server model imports cannot enter active admin code; replace with typed data facades.',
  },
  {
    source: '~/routes/',
    target: 'PageFly app-platform API facades',
    status: 'blocked',
    notes: 'Remix route constants/actions need explicit PageFly facade adapters before execution.',
  },
] as const satisfies readonly ProductEditorIslandAliasContract[]

/**
 * Narrow aliases and blockers must be evaluated before the broad TailorKit `~/` upstream mirror.
 * This prevents copy-first migration from becoming a blind server-code import into PageFly admin.
 */
export const productEditorIslandAliasPrecedence = [
  '@remix-run/react',
  '~/shopify/fns.client',
  '~/utils/shopify',
  '~/utils/toastEvents',
  '~/bootstrap/hooks/useNavigateAppBridge',
  '~/utils/hooks/useLiveChat',
  '~/bootstrap/hoc/withCrispChat',
  '~/bootstrap/hoc/withNavMenu',
  '~/bootstrap/hoc/withFeedback',
  '~/bootstrap/hoc/withTourGuide',
  '~/modules/IdleTimeTracker/withIdleTracker',
  '~/modules/Feedback/hooks/useGatherUserFeedbackForm',
  '~/modules/InteractiveChat/withInteractiveChat',
  'crisp-sdk-web',
  '~/providers/ChatBotContext',
  '~/root',
  '~/routes/dashboard/route',
  'blocked:~/models/',
  'blocked:~/routes/',
  '~/',
  'extensions/tailorkit-src/',
] as const

/**
 * Inventory of upstream imports that still need PageFly adapter decisions before the copied editor
 * can be compiled as the primary detail surface. Keep TailorKit core copied; adapt only these edges.
 */
export const productEditorIslandImportBoundaryContracts = [
  {
    source: '~/models/*.server',
    status: 'type-only-reference',
    examples: ['~/models/Layer.server'],
    notes: 'Layer document shapes are allowed as copied type contracts only; no Mongoose model runtime may enter admin.',
  },
  {
    source: '~/models/helpers/*',
    status: 'requires-pagefly-facade',
    examples: ['~/models/helpers/pricing-utils', '~/models/PricingPlan.fns'],
    notes: 'Pricing and plan helpers currently depend on TailorKit server models; expose PageFly-safe capability/pricing facades instead.',
  },
  {
    source: '~/models/* runtime',
    status: 'requires-pagefly-facade',
    examples: ['~/models/ClipartClickEvent', '~/models/PricingPlan', '~/models/Shop'],
    notes: 'Runtime model imports are blocked even when the upstream file is copied for reference.',
  },
  {
    source: '~/routes/api.*/* constants',
    status: 'upstream-reference-only',
    examples: ['~/routes/api.templates/constants', '~/routes/api.integrations/constants', '~/routes/api.shopify/constants'],
    notes: 'Pure constants may stay copied as reference, but action execution must go through authenticatedFetch and PageFly ports.',
  },
  {
    source: '~/routes/*/route',
    status: 'requires-pagefly-facade',
    examples: ['~/routes/personalized-products.$id/route', '~/routes/templates.$id/route.tsx', '~/routes/api.charm-products/route'],
    notes: 'Remix loaders/actions are reference material only; PageFly owns loader/action execution through app-platform endpoints.',
  },
  {
    source: '~/routes/pricing._index/* and ~/routes/dashboard/*',
    status: 'requires-pagefly-facade',
    examples: ['~/routes/pricing._index/fns', '~/routes/dashboard/components/PublishToEarnCard'],
    notes: 'Commercial, onboarding, and PTE UI should be adapted to PageFly capability gates before becoming executable.',
  },
] as const satisfies readonly ProductEditorIslandImportBoundaryContract[]

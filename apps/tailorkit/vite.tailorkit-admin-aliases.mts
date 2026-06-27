import path from 'path'

export interface TailorKitAdminViteAliasesOptions {
  appRoot: string
}

/** Shared aliases for TailorKit admin bundles so copied routes and ProductEditor use the same PageFly seams. */
export function createTailorKitAdminViteAliases({ appRoot }: TailorKitAdminViteAliasesOptions) {
  const productEditorIslandRoot = path.resolve(appRoot, 'src/admin/product-editor-island')
  const upstreamRoot = path.resolve(appRoot, 'upstream/tailorkit-app')
  const upstreamAppRoot = path.resolve(upstreamRoot, 'app')
  const upstreamExtensionRoot = path.resolve(upstreamRoot, 'extensions/tailorkit-src')

  return [
    {
      find: /^@remix-run\/react$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-remix-react-shim.tsx'),
    },
    {
      find: /^~\/shopify\/fns\.client$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-authenticated-fetch-shim.ts'),
    },
    {
      // ContextualSaveBar imports @shopify/app-bridge-react useAppBridge, which throws without the
      // app-bridge-react provider the app-platform runtime doesn't mount. Shim drives window.shopify.saveBar.
      find: /^~\/components\/ContextualSaveBar$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-contextual-save-bar-shim.tsx'),
    },
    {
      find: /^~\/utils\/shopify$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-shopify-shim.ts'),
    },
    {
      find: /^~\/utils\/toastEvents$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-toast-events-shim.ts'),
    },
    {
      find: /^~\/bootstrap\/hooks\/useNavigateAppBridge$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-navigate-app-bridge-shim.tsx'),
    },
    {
      find: /^~\/utils\/hooks\/useLiveChat$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-live-chat-shim.ts'),
    },
    {
      find: /^~\/bootstrap\/hoc\/withCrispChat$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-live-chat-shim.ts'),
    },
    {
      find: /^~\/bootstrap\/hoc\/withNavMenu$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-route-behavior-shim.tsx'),
    },
    {
      find: /^~\/bootstrap\/hoc\/withFeedback$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-route-behavior-shim.tsx'),
    },
    {
      find: /^~\/bootstrap\/hoc\/withTourGuide$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-route-behavior-shim.tsx'),
    },
    {
      find: /^~\/modules\/IdleTimeTracker\/withIdleTracker$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-route-behavior-shim.tsx'),
    },
    {
      find: /^~\/modules\/Feedback\/hooks\/useGatherUserFeedbackForm$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-feedback-shim.ts'),
    },
    {
      find: /^~\/modules\/InteractiveChat\/withInteractiveChat$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-interactive-chat-shim.tsx'),
    },
    {
      find: /^crisp-sdk-web$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-live-chat-shim.ts'),
    },
    {
      find: /^~\/providers\/ChatBotContext$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-chatbot-context-shim.tsx'),
    },
    {
      find: /^~\/root$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-root-shim.ts'),
    },
    {
      find: /^~\/components\/BackgroundRemovalInitializer$/,
      replacement: path.resolve(productEditorIslandRoot, 'pagefly-background-removal-initializer-shim.tsx'),
    },
    {
      find: /^~\/routes\/dashboard\/route$/,
      replacement: path.resolve(productEditorIslandRoot, 'facades/app/routes/dashboard/route.tsx'),
    },
    {
      find: /^extensions\/tailorkit-src\/(.*)$/,
      replacement: `${upstreamExtensionRoot}/$1`,
    },
    {
      find: /^~\/(.*)$/,
      replacement: `${upstreamAppRoot}/$1`,
    },
  ]
}

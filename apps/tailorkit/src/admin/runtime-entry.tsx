import React from 'react'
import { AppProvider as PolarisAppProvider } from '@shopify/polaris'
import polarisTranslations from '@shopify/polaris/locales/en.json'
import { createRoot, type Root } from 'react-dom/client'
import type { AdminAppHost } from '../../../../web/core/src/app-platform/admin'
import { TailorKitAdmin } from './index'

export interface TailorKitAdminRuntime {
  mount(container: Element, host: AdminAppHost): void
  unmount(container: Element): void
}

declare global {
  interface Window {
    PageFlyAppPlatformAdmins?: Record<string, TailorKitAdminRuntime | undefined>
  }
}

const roots = new WeakMap<Element, Root>()

export function unmount(container: Element): void {
  const root = roots.get(container)
  if (!root) return

  root.unmount()
  roots.delete(container)
}

export function mount(container: Element, host: AdminAppHost): void {
  unmount(container)

  const root = createRoot(container)
  root.render(
    <PolarisAppProvider i18n={polarisTranslations}>
      <TailorKitAdmin host={host} />
    </PolarisAppProvider>
  )
  roots.set(container, root)
}

if (typeof window !== 'undefined') {
  window.PageFlyAppPlatformAdmins = {
    ...(window.PageFlyAppPlatformAdmins || {}),
    tailorkit: { mount, unmount },
  }
}

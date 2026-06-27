import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { AppApiClient } from '../../../../../web/core/src/app-platform/admin'
import ProductEditor from '../../../upstream/tailorkit-app/app/modules/ProductEditor'
import type { TailorKitProductEditorLoaderData } from '../../domain/product-editor-loader-adapter'
import { bindPageFlyAuthenticatedFetch, bindPageFlyRawFetch } from './pagefly-authenticated-fetch-shim'
import {
  TailorKitProductEditorLoaderProvider,
  type TailorKitProductEditorRouteNavigate,
  type TailorKitProductEditorRouteSnapshot,
} from './pagefly-product-editor-loader-context'

export interface TailorKitProductEditorRuntimeProps {
  apiClient: AppApiClient
  loaderData: TailorKitProductEditorLoaderData
  route?: TailorKitProductEditorRouteSnapshot | null
  onNavigate?: TailorKitProductEditorRouteNavigate
}

export interface TailorKitProductEditorIslandHandle {
  unmount(): void
}

export const TailorKitProductEditorRuntime: React.FC<TailorKitProductEditorRuntimeProps> = ({
  apiClient,
  loaderData,
  route,
  onNavigate,
}) => {
  bindPageFlyAuthenticatedFetch(apiClient)
  bindPageFlyRawFetch(apiClient)

  return (
    <TailorKitProductEditorLoaderProvider loaderData={loaderData} route={route} onNavigate={onNavigate}>
      <ProductEditor />
    </TailorKitProductEditorLoaderProvider>
  )
}

export function renderTailorKitProductEditorIsland(
  target: HTMLElement,
  props: TailorKitProductEditorRuntimeProps
): TailorKitProductEditorIslandHandle {
  let root: Root | null = createRoot(target)
  root.render(<TailorKitProductEditorRuntime {...props} />)

  return {
    unmount() {
      root?.unmount()
      root = null
      bindPageFlyAuthenticatedFetch(null)
      bindPageFlyRawFetch(null)
    },
  }
}

declare global {
  interface Window {
    PageFlyTailorKitProductEditorIsland?: {
      render: typeof renderTailorKitProductEditorIsland
    }
  }
}

if (typeof window !== 'undefined') {
  window.PageFlyTailorKitProductEditorIsland = {
    render: renderTailorKitProductEditorIsland,
  }
}

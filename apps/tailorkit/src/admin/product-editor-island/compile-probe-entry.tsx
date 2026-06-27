import React from 'react'
import ProductEditor from '../../../upstream/tailorkit-app/app/modules/ProductEditor'

/**
 * Compile-only probe for the copied TailorKit ProductEditor island.
 * Do not import this file from PageFly admin runtime.
 */
export function ProductEditorIslandCompileProbe() {
  return <ProductEditor />
}

export default ProductEditorIslandCompileProbe

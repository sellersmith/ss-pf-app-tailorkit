// Append the canvas to the featured image container

import type { TailorKitProductPersonalizer } from '../types/product-personalizer'
import { TAILORKIT_PRODUCT_PERSONALIZER_ERRORS } from '../constants/errors'
import { logError } from '../fns/logs'
import { getFeaturedImageContainerSelector } from './init-canvas'
import { applyCenteringStyles } from './center-element-styles'
import { getZoomSettings } from '../features/pinch-zoom/settings'

export const renderCanvasToMainContainer = async (element: TailorKitProductPersonalizer) => {
  const selector = getFeaturedImageContainerSelector(element)
  const container = document.querySelector(selector)

  if (!container) {
    logError(
      `${TAILORKIT_PRODUCT_PERSONALIZER_ERRORS.FEATURED_IMAGE_CONTAINER_NOT_FOUND}: ${element.settings.featured_image_container_selector}`
    )
    return
  }

  const stage = element.canvasManager.getStage()
  const stageContainer = stage.container()
  const containerStyle = window.getComputedStyle(container)

  // Change container position to 'relative' only if it is not absolutely positioned
  if (containerStyle.getPropertyValue('position') !== 'absolute') {
    container.style.position = 'relative'
  }

  // Set canvas position to 'absolute' and center in container
  applyCenteringStyles(stageContainer)

  if (!element.productPersonalizer.pi) {
    // Find the featured product image
    const featuredImage = document.querySelector(`${selector} img`) as HTMLImageElement

    if (featuredImage) {
      await new Promise(resolve => {
        const img = new Image()
        img.src = featuredImage.src.replace(/&width=\d+/, '')

        img.onload = () => {
          stage.width(img.width)
          stage.height(img.height)
          resolve(1)
        }
      })
    } else {
      // Find the container of the feature product image
      if (container) {
        stage.width(container.offsetWidth)
        stage.height(container.offsetHeight)
      }
    }
  }

  // Add stageContainer to the page first
  container.appendChild(stageContainer)

  // Wrap konvajs-content with zoom component if enabled
  // Note: tailorkit-zoom must be INSIDE stageContainer (not wrapping it)
  // because stageContainer has position:absolute which would collapse tailorkit-zoom height
  const zoomSettings = getZoomSettings()
  if (zoomSettings.enabled) {
    const konvaContent = stageContainer.querySelector('.konvajs-content')
    if (konvaContent) {
      const zoomWrapper = document.createElement('tailorkit-zoom')
      const attributes = {
        'min-scale': '1',
        'max-scale': '3',
        'double-tap-scale': '2',
        'show-indicator': zoomSettings.showIndicator ? 'true' : 'false',
      }
      Object.entries(attributes).forEach(([key, value]) => {
        zoomWrapper.setAttribute(key, value)
      })

      // Insert zoom wrapper where konvaContent is, then move konvaContent inside
      konvaContent.parentElement?.insertBefore(zoomWrapper, konvaContent)
      zoomWrapper.appendChild(konvaContent)
    }
  }
}

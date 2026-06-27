import { CARD_TARGET_SPACING, ECardPlacement } from '../constants'
import type { GuidedTourFlow } from '../types'

/**
 * Calculates the position of a card element relative to a target element based on the specified placement
 * @param placement - The desired placement of the card relative to the target (e.g. top, bottom, left, right)
 * @param targetRect - The DOMRect of the target element
 * @param cardRect - The DOMRect of the card element
 * @param spacing - The spacing between the card and target element
 * @returns {Object} The calculated top and left position coordinates
 */
export function getPositionByPlacement(
  placement: ECardPlacement,
  targetRect: DOMRect,
  cardRect: DOMRect,
  spacing: number
) {
  let top = 0
  let left = 0

  switch (placement) {
    // Top variations - card appears above the target
    case ECardPlacement.TOP:
    case ECardPlacement.TOP_CENTER:
      top = targetRect.top - cardRect.height - spacing
      left = targetRect.left + (targetRect.width - cardRect.width) / 2
      break
    case ECardPlacement.TOP_LEFT:
      top = targetRect.top - cardRect.height - spacing
      left = targetRect.left
      break
    case ECardPlacement.TOP_RIGHT:
      top = targetRect.top - cardRect.height - spacing
      left = targetRect.right - cardRect.width
      break

    // Bottom variations - card appears below the target
    case ECardPlacement.BOTTOM:
    case ECardPlacement.BOTTOM_CENTER:
      top = targetRect.bottom + spacing
      left = targetRect.left + (targetRect.width - cardRect.width) / 2
      break
    case ECardPlacement.BOTTOM_LEFT:
      top = targetRect.bottom + spacing
      left = targetRect.left
      break
    case ECardPlacement.BOTTOM_RIGHT:
      top = targetRect.bottom + spacing
      left = targetRect.right - cardRect.width
      break

    // Left variations - card appears to the left of target
    case ECardPlacement.LEFT:
    case ECardPlacement.LEFT_CENTER:
      top = targetRect.top + (targetRect.height - cardRect.height) / 2
      left = targetRect.left - cardRect.width - spacing
      break
    case ECardPlacement.LEFT_TOP:
      top = targetRect.top
      left = targetRect.left - cardRect.width - spacing
      break
    case ECardPlacement.LEFT_BOTTOM:
      top = targetRect.bottom - cardRect.height
      left = targetRect.left - cardRect.width - spacing
      break

    // Right variations - card appears to the right of target
    case ECardPlacement.RIGHT:
    case ECardPlacement.RIGHT_CENTER:
      top = targetRect.top + (targetRect.height - cardRect.height) / 2
      left = targetRect.right + spacing
      break
    case ECardPlacement.RIGHT_TOP:
      top = targetRect.top
      left = targetRect.right + spacing
      break
    case ECardPlacement.RIGHT_BOTTOM:
      top = targetRect.bottom - cardRect.height
      left = targetRect.right + spacing
      break

    // Center - card appears centered over the target
    case ECardPlacement.CENTER:
      top = targetRect.top + (targetRect.height - cardRect.height) / 2
      left = targetRect.left + (targetRect.width - cardRect.width) / 2
      break

    // Default to center if no placement specified
    default:
      top = targetRect.top + (targetRect.height - cardRect.height) / 2
      left = targetRect.left + (targetRect.width - cardRect.width) / 2
  }

  return { top, left }
}

/**
 * Generates CSS styles for the tooltip triangle based on card placement
 * @param placement - The placement of the card relative to the target
 * @param cardRect - The DOMRect of the card element
 * @returns {Partial<CSSStyleDeclaration>} CSS styles for the triangle
 */
export function getTriangleStyleByPlacement(placement: ECardPlacement, cardRect: DOMRect, triangleColor?: string) {
  // Base triangle styles
  const style: Partial<CSSStyleDeclaration> = {
    position: 'absolute',
    width: '0',
    height: '0',
    borderLeft: '8px solid transparent',
    borderRight: '8px solid transparent',
    borderBottom: `8px solid ${triangleColor || 'rgb(48, 48, 48)'}`,
  }

  switch (placement) {
    // Top placements - triangle points down
    case ECardPlacement.TOP:
    case ECardPlacement.TOP_CENTER:
      style.bottom = '-7px'
      style.transform = 'rotate(180deg)'
      style.left = `${cardRect.width / 2 - 8}px`
      break

    case ECardPlacement.TOP_LEFT:
      style.bottom = '-7px'
      style.transform = 'rotate(180deg)'
      style.left = '16px'
      break

    case ECardPlacement.TOP_RIGHT:
      style.bottom = '-7px'
      style.transform = 'rotate(180deg)'
      style.right = '16px'
      break

    // Bottom placements - triangle points up
    case ECardPlacement.BOTTOM:
    case ECardPlacement.BOTTOM_CENTER:
      style.top = '-7px'
      style.left = `${cardRect.width / 2 - 8}px`
      break

    case ECardPlacement.BOTTOM_LEFT:
      style.top = '-7px'
      style.left = '16px'
      break

    case ECardPlacement.BOTTOM_RIGHT:
      style.top = '-7px'
      style.right = '16px'
      break

    // Left placements - triangle points right
    case ECardPlacement.LEFT:
    case ECardPlacement.LEFT_CENTER:
      style.right = '-11px'
      style.top = `${cardRect.height / 2 - 8}px`
      style.transform = 'rotate(-270deg)'
      break

    case ECardPlacement.LEFT_TOP:
      style.right = '-11px'
      style.top = '16px'
      style.transform = 'rotate(-270deg)'
      break

    case ECardPlacement.LEFT_BOTTOM:
      style.right = '-11px'
      style.bottom = '7px'
      style.transform = 'rotate(-270deg)'
      break

    // Right placements - triangle points left
    case ECardPlacement.RIGHT:
    case ECardPlacement.RIGHT_CENTER:
      style.left = '-11px'
      style.top = `${cardRect.height / 2 - 8}px`
      style.transform = 'rotate(270deg)'
      break

    case ECardPlacement.RIGHT_TOP:
      style.left = '-11px'
      style.top = '16px'
      style.transform = 'rotate(270deg)'
      break

    case ECardPlacement.RIGHT_BOTTOM:
      style.left = '-11px'
      style.bottom = '16px'
      style.transform = 'rotate(270deg)'
      break

    case ECardPlacement.CENTER:
      // Center placement doesn't need a triangle
      break
  }

  return style
}

/**
 * Gets the current viewport dimensions
 * @returns {Object} The viewport width and height
 */
export function getViewportDimension() {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 }
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

/**
 * Scrolls an element to the center of the viewport
 * @param element - The HTML element to center
 */
export function scrollElementToCenter(element: Element) {
  element.scrollIntoView({ block: 'center' })
}

/**
 * Constrains a position to stay within the viewport bounds
 * @param initialPosition - The initial top/left position
 * @param cardRect - The DOMRect of the card element
 * @param viewport - The viewport dimensions
 * @returns {Object} The constrained top and left position coordinates
 */
export function constrainPositionToViewport(
  initialPosition: { top: number; left: number },
  cardRect: DOMRect,
  viewport: { width: number; height: number }
) {
  // Constrain left position between minimum spacing and maximum viewport width minus card width
  const left = Math.max(
    CARD_TARGET_SPACING,
    Math.min(initialPosition.left, viewport.width - cardRect.width - CARD_TARGET_SPACING)
  )

  // Constrain top position between minimum spacing and maximum viewport height minus card height
  const top = Math.max(
    CARD_TARGET_SPACING,
    Math.min(initialPosition.top, viewport.height - cardRect.height - CARD_TARGET_SPACING)
  )

  return { left, top }
}

/**
 * Adds a tooltip triangle to a card element
 * @param cardElement - The card HTML element
 * @param placement - The placement of the card relative to target
 * @param cardRect - The DOMRect of the card element
 */
export function addTooltipTriangle(
  cardElement: HTMLElement,
  placement: ECardPlacement,
  cardRect: DOMRect,
  triangleColor?: string
) {
  const triangle = document.createElement('div')
  triangle.className = 'tooltip-triangle'
  Object.assign(triangle.style, getTriangleStyleByPlacement(placement, cardRect, triangleColor))

  // Remove any existing triangle before adding new one
  cardElement.querySelector('.tooltip-triangle')?.remove()
  cardElement.appendChild(triangle)
}

/**
 * Filters an onboarding flow to only include steps with valid, visible target elements
 * @param flow - The onboarding flow configuration object
 * @returns {GuidedTourFlow} A new flow object with only valid steps
 */
export function getValidFlow(flow: GuidedTourFlow): GuidedTourFlow {
  if (!flow?.steps?.length) {
    return flow
  }

  return {
    ...flow,
    steps: flow.steps.filter(step => {
      if (!step.element) return false
      const targetEl = document.querySelector(step.element) as HTMLElement

      return targetEl && targetEl.offsetWidth > 0 && targetEl.offsetHeight > 0
    }),
  }
}

/**
 * Enable/disable scroll of body
 *
 * @param allowScroll boolean
 */
export const toggleScroll = (allowScroll: boolean) => {
  if (allowScroll) {
    document.body.style.overflowY = 'auto'
  } else {
    document.body.style.overflowY = 'hidden'
  }
}

/* eslint-disable max-lines */
// @ts-nocheck
import morphdom from 'morphdom'
import { EHtmlSelectors, EPubSubEvents } from '../constants'
import { publish } from '../utils/pubsub'
import { windowFunctionCustom } from '../utils/windowFunction'

/**
 * @author Harry
 */

// Dawn, Craft, Taste, Refresh, Sense, Horizon
function handleFreeShopifyTheme(addedItemRes: any, callback?: () => Promise<void> | void): void {
  fetch('/?sections=cart-notification-product,cart-notification-button,cart-drawer,cart-icon-bubble')
    .then(response => response.json())
    .then(async sections => {
      addedItemRes.sections = sections
      const hasCartItems = addedItemRes?.items && addedItemRes.items.length > 0

      const cartDrawer = document.querySelector('cart-drawer') || document.querySelector('cart-notification')
      if (cartDrawer && window.location.pathname !== '/cart' && hasCartItems) {
        cartDrawer.classList.remove('is-empty')
        if (typeof (cartDrawer as any).renderContents === 'function') {
          ;(cartDrawer as any).renderContents(addedItemRes)
        }
      }

      typeof window.publish === 'function'
        && window.publish(EPubSubEvents.CART_UPDATE, {
          cartData: addedItemRes,
        })

      await callback?.()
    })
    .catch(error => console.error('Error fetching sections:', error))
}

// Impact 3.0.0
function handleImpactTheme(cart: any, callback?: () => Promise<void> | void): void {
  fetch('/?section_id=cart-drawer')
    .then(d => d.text())
    .then(async text => {
      const parser = new DOMParser()
      const sectionInnerHTML = parser.parseFromString(text, 'text/html')
      const cartFormInnerHTML = sectionInnerHTML.getElementById('cart-drawer')?.innerHTML

      // Update the cart-drawer inner HTML
      ;(document.getElementById('cart-drawer') as HTMLElement).innerHTML = cartFormInnerHTML || ''

      // Click the element with aria-controls="cart-drawer"
      ;(document.querySelector('[aria-controls="cart-drawer"]') as HTMLElement)?.click()

      // Update the cart count and set opacity
      const cartCountElement: HTMLElement | null = document.querySelector('.header__cart-count .count-bubble')
      if (cartCountElement) {
        cartCountElement.innerHTML = cart.item_count
        cartCountElement.style.opacity = '1'
      }

      await callback?.()
    })
    .catch(error => console.error('Failed to update cart Impact Theme', error))
}

// Athens 1.6.1
function handleAthensTheme(cart: any, callback?: () => Promise<void> | void): void {
  fetch('/cart?view=mini-cart')
    .then(d => d.text())
    .then(async text => {
      const parser = new DOMParser()
      const sectionInnerHTML = parser.parseFromString(text, 'text/html')
      const cartFormInnerHTML = sectionInnerHTML.getElementById('HeaderMiniCart')

      // Update the HeaderMiniCart inner HTML
      const headerMiniCart = document.getElementById('HeaderMiniCart')
      headerMiniCart && cartFormInnerHTML && (headerMiniCart.innerHTML = cartFormInnerHTML.innerHTML)

      // Update the cart link quantity or append it if it doesn't exist
      const cartLinkQuantity = document.querySelector('.head-slot-cart-link .head-slot-cart-link-quantity')
      if (cartLinkQuantity) {
        cartLinkQuantity.innerHTML = cart.item_count
      } else {
        const cartLink = document.querySelector('.head-slot-cart-link')
        const span = document.createElement('span')
        span.className = 'head-slot-cart-link-quantity'
        span.textContent = cart.item_count
        cartLink && cartLink.appendChild(span)
      }

      // Click the cart link
      ;(document.querySelector('a.head-slot-nav-link.head-slot-cart-link') as HTMLElement).click()

      await callback?.()
    })
    .catch(error => console.error('Failed to update cart Athens Theme', error))
}

// Flow
async function handleFlowTheme(cart: any, callback?: () => Promise<void> | void): void {
  await window.wetheme.updateCartDrawer(cart)
  await window.wetheme.toggleRightDrawer('cart', true, { cart })

  await callback?.()
}

// Gecko theme
async function handleGeckoTheme(addedItemRes: any, callback?: () => Promise<void> | void): void {
  await window.geckoShopify.onCartUpdate(1, 1, addedItemRes.id)

  await callback?.()
}

// Alto theme
async function handleAltoTheme(callback?: () => Promise<void> | void): void {
  await window.cart.getCart()

  await callback?.()
}

// Debutify theme
async function handleDebutifyTheme(callback?: () => Promise<void> | void): void {
  await window.theme.ajaxCart.update()

  await callback?.()
}

// Avone theme
async function handleAvoneTheme(callback?: () => Promise<void> | void): void {
  await window.CartJS.getCart()

  await callback?.()
}

// Showtime theme
async function handleShowtimeTheme(cart: any, callback?: () => Promise<void> | void): void {
  await window.Shopify.updateQuickCart(cart)

  await callback?.()
}

// Rebranding theme
async function handleRebrandingTheme(cart: any, callback?: () => Promise<void> | void): void {
  const _config = {
    cartCountSelector: '.cartCountSelector',
    cartTotalSelector: '.cartTotalSelector',
  }

  const ajaxLoadPage = (url: string): void => {
    fetch(url)
      .then(response => response.text())
      .then(async data => {
        const parser = new DOMParser()
        const doc = parser.parseFromString(data, 'text/html')
        const newContent = doc.querySelector('#cart-dropdown-span')?.innerHTML
        if (newContent) {
          document.querySelector('#cart-dropdown-span')!.innerHTML = newContent
        }

        await callback?.()
      })
      .catch(error => console.error('Failed to update cart dropdown', error))
  }

  const cartCountElement = document.querySelector(_config.cartCountSelector)
  const cartTotalElement = document.querySelector(_config.cartTotalSelector)

  if (cartCountElement) {
    const value = cartCountElement.innerHTML || '0'
    cartCountElement.innerHTML = value.replace(/[0-9]+/, cart.item_count.toString())
    cartCountElement.classList.remove('hidden')
    if (cartTotalElement) {
      cartTotalElement.innerHTML = window.Shopify.formatMoney(cart.total_price, window.theme.moneyFormat).replace(
        /((\,00)|(\.00))$/g,
        ''
      )
    }
  }

  ajaxLoadPage('/cart?view=mini-cart') // Ensure the URL is passed correctly
}

// Envy theme
async function handleEnvyTheme(cart: any, callback?: () => Promise<void> | void): void {
  await window.wetheme.updateCartDrawer(cart)
  await window.wetheme.drawer.slideouts.right.open()

  await callback?.()
}

// Marker theme
async function handleMarkerTheme(callback?: () => Promise<void> | void): void {
  await window.theme.cart.fetchTotals()
  await window.theme.cart.updateAllHtml()

  await callback?.()
}

// Express theme
async function handleExpressTheme(addedItemRes: any, callback?: () => Promise<void> | void): void {
  await Promise.all(window.carts.map(e => e.onCartUpdated(addedItemRes.id)))

  await callback?.()
}

//Impulse
async function handleImpulseTheme(callback?: () => Promise<void> | void): void {
  document.dispatchEvent(new CustomEvent('ajaxProduct:added'))
  document.dispatchEvent(new CustomEvent('cart:build'))

  await callback?.()
}

async function handleFocalTheme(cart: any, callback?: () => Promise<void> | void): void {
  document.documentElement.dispatchEvent(
    new CustomEvent('cart:refresh', {
      bubbles: true,
    })
  )

  const miniCart = document.getElementById('mini-cart') as HTMLDetailsElement
  if (miniCart) {
    miniCart.open = true
  }

  const cartCountElement = document.querySelector('cart-count') as HTMLElement
  if (cartCountElement) {
    cartCountElement.innerText = cart.item_count.toString()
  }

  await callback?.()
}

// Modular theme
async function handleModularTheme(callback?: () => Promise<void> | void): void {
  await window.cart.getCart()

  await callback?.()
}

// Foodie theme
async function handleFoodieTheme(cart: any, callback?: () => Promise<void> | void): void {
  let config = document.getElementById('cart-config')
  if (!config) return false
  config = JSON.parse(config.innerHTML || '{}')
  window.WAU.AjaxCart.updateView(config, cart)

  await callback?.()
}

//Warehouse theme
async function handleWarehouseTheme(addedItemRes: any, callback?: () => Promise<void> | void): void {
  document.dispatchEvent(
    new CustomEvent('product:added', {
      bubbles: !0,
      detail: {
        variant: addedItemRes.variant_id,
        quantity: 1,
      },
    })
  )

  await callback?.()
}

// Lammer theme
async function handleLammerTheme(addedItemRes: any, callback?: () => Promise<void> | void): void {
  const htmlVariant = addedItemRes.variant_title !== null ? `<i>(${addedItemRes.variant_title})</i>` : ''
  const styleCart = document.querySelector('.js-mini-cart')?.getAttribute('data-cartmini')

  if (styleCart !== 'true') {
    const htmlAlert = `
      <div class="media mt-2 alert--cart">
        <a class="mr-3" href="/cart">
          <img class="lazyload" data-src="${addedItemRes.image}">
        </a>
        <div class="media-body align-self-center">
          <p class="m-0 font-weight-bold">${addedItemRes.product_title} x ${addedItemRes.quantity}</p>
          ${htmlVariant}
        </div>
      </div>
    `
    await window.theme.alert.new(window.theme.strings.addToCartSuccess, htmlAlert, 3000, 'notice')
  }

  await window.theme.miniCart.updateElements()
  await window.theme.miniCart.generateCart()

  await callback?.()
}

//Furns - Furniture Shopify theme
async function handleFurnTheme(addedItemRes: any, cart: any, callback?: () => Promise<void> | void): void {
  await window.Shopify.onItemAdded(addedItemRes)
  await window.Shopify.onCartUpdate(cart)
  // Ensure jQuery is loaded and properly typed
  const jQuery = window.jQuery
  if (jQuery) {
    jQuery('#modalAddToCart').modal('toggle')
  }

  const popupImageElement = document.querySelector('.popupimage') as HTMLImageElement
  if (popupImageElement) {
    popupImageElement.src = addedItemRes.image
  }

  await callback?.()
}

// Turbo theme
async function handleTurboTheme(cart: any, callback?: () => Promise<void> | void): void {
  if (window.refreshCart) {
    await window.refreshCart(cart)
  }

  if (document.querySelector('#header')?.matches(':visible')) {
    document.querySelector('#header .cart-container')?.classList.add('active_link')
  } else if (document.querySelector('.sticky_nav--stick')) {
    document.querySelector('.sticky_nav .cart-container')?.classList.add('active_link')
  } else {
    document.querySelector('.top-bar .cart-container')?.classList.add('active_link')
  }

  // Block scrolling on mobile
  if (window.PXUTheme.media_queries.medium.matches) {
    const cartContainer = document.querySelector('.active_link')?.parentElement
    if (cartContainer) {
      document.body.classList.add('blocked-scroll')
    } else {
      document.body.classList.add('blocked-scroll')
    }

    // Scroll to the top of the page unless the header is fixed
    const header = document.getElementById('header')
    if (header && header.classList.contains('mobile_nav-fixed--false')) {
      window.scroll({ top: 0, left: 0, behavior: 'smooth' })
    }
  }

  await callback?.()
}

// Emerge Shopify theme
async function handleEmergeTheme(cart: any, callback?: () => Promise<void> | void): void {
  fetch('/?snippets_id=cart')
    .then(response => response.text())
    .then(async text => {
      const parser = new DOMParser()
      const sectionInnerHTML = parser.parseFromString(text, 'text/html')
      const checkCart = sectionInnerHTML.querySelector('[data-active="cart"]')

      if (checkCart) {
        const cartFormInnerHTML = checkCart.innerHTML
        const activeCart = document.querySelector('[data-active="cart"]')
        if (activeCart) {
          activeCart.innerHTML = cartFormInnerHTML
        }

        const headerCartLink = document.querySelector('.header--cart-link')
        if (headerCartLink) {
          headerCartLink.setAttribute('data-has-items', 'true')
        }

        const externalTotalItems = document.querySelector('.cart--external--total-items')
        if (externalTotalItems) {
          externalTotalItems.textContent = cart.item_count.toString()
        }

        const externalTotalPrice = document.querySelector('.cart--external--total-price')
        if (externalTotalPrice) {
          const totalPrice = document.querySelector('.cart--total--price.money')
          if (totalPrice) {
            externalTotalPrice.textContent = totalPrice.textContent
          }
        }

        const cartToggleLink = document.querySelector('a.header--cart-toggle')
        if (cartToggleLink) {
          ;(cartToggleLink as HTMLElement).click()
        }

        await callback?.()
      }
    })
    .catch(e => console.error('Error:', e))
}

// Minimog theme
async function handleMinimogTheme(cart: any, addedItemRes: any, callback?: () => Promise<void> | void): void {
  await window.Shopify.onItemAdded(addedItemRes)
  await window.Shopify.onCartUpdate(cart)

  await callback?.()
}

// Province theme
async function handleProvinceTheme(cart: any, callback?: () => Promise<void> | void): void {
  const countHtml = document.createElement('span')
  countHtml.classList.add('item-count', 'inline-block', 'text-center')

  const cartElement = document.querySelector('.cart')
  if (cartElement) {
    cartElement.appendChild(countHtml)
    countHtml.innerHTML = cart.item_count.toString()
  }

  await callback?.()
}

// Motion theme
async function handleMotionTheme(cart: any, callback?: () => Promise<void> | void): void {
  document.dispatchEvent(
    new CustomEvent('ajaxProduct:added', {
      detail: {
        product: cart,
      },
    })
  )

  await new Promise(resolve => setTimeout(resolve, 1000))

  await callback?.()
}

//Ella theme
async function handleEllaTheme(callback?: () => Promise<void> | void): void {
  setTimeout(async () => {
    const renderSidebar = document.querySelector('#cart-icon-bubble') as HTMLElement
    if (renderSidebar) {
      renderSidebar.click()
    }

    setTimeout(async () => {
      await callback?.()
    }, 400)
  }, 400)
}

// Be Yours Theme
async function handleBeYoursTheme(addedItemRes: any, callback?: () => Promise<void> | void): void {
  fetch('/?sections=mini-cart,cart-icon-bubble')
    .then(response => response.json())
    .then(async sections => {
      const miniCart = document.querySelector('mini-cart') as any
      if (miniCart && typeof miniCart.renderContents === 'function') {
        addedItemRes.sections = sections
        miniCart.renderContents(addedItemRes)
      }
      await callback?.()
    })
    .catch(error => console.error('Error fetching sections:', error))
}

// Quark Theme
async function handleQuarkTheme(cart: any, callback?: () => Promise<void> | void): void {
  document.documentElement.dispatchEvent(
    new CustomEvent('cart:refresh', {
      bubbles: true,
      detail: {
        cart: cart,
        openMiniCart: window.themeVariables.settings.cartType === 'drawer' && !document.querySelector('.drawer'),
      },
    })
  )

  const cartIcon = document.querySelectorAll('.header__icon-wrapper[aria-label="Cart"]')[0] as HTMLElement
  if (cartIcon) {
    cartIcon.click()
  }

  setTimeout(async () => {
    await callback?.()
  }, 400)
}

// Launch Theme
async function handleLaunchTheme(cart: any, callback?: () => Promise<void> | void): void {
  const headerCartCountElements = document.querySelectorAll('.header-cart-count')

  headerCartCountElements.forEach(element => {
    element.textContent = cart.item_count.toString()
    element.classList.add('active')
  })

  await callback?.()
}

// Stockholm Theme
async function handleStockholmTheme(cart: any, callback?: () => Promise<void> | void): void {
  fetch('/?snippets_id=cart-notification')
    .then(response => response.text())
    .then(async text => {
      const parser = new DOMParser()
      const sectionInnerHTML = parser.parseFromString(text, 'text/html')
      const cartNotification = sectionInnerHTML.getElementById('cart-notification')
      const totalPriceElement = sectionInnerHTML.querySelector('#cart-notification .totals__subtotal-value')

      if (cartNotification && totalPriceElement) {
        const cartFormInnerHTML = cartNotification.innerHTML

        const cartNotificationElement = document.getElementById('cart-notification')
        if (cartNotificationElement) {
          cartNotificationElement.innerHTML = cartFormInnerHTML
        }

        const cartDrawer = document.querySelector('cart-drawer')
        const cartDrawerItems = document.querySelector('cart-drawer-items')
        if (cartDrawer) {
          cartDrawer.classList.remove('is-empty')
        }
        if (cartDrawerItems) {
          cartDrawerItems.classList.remove('is-empty')
        }

        const cartIconBubble = document.querySelector('#cart-icon-bubble')
        if (cartIconBubble) {
          const cartCountBubble = cartIconBubble.querySelector('.cart-count-bubble')
          if (!cartCountBubble) {
            const cartNumber = document.createElement('div')
            cartNumber.className = 'cart-count-bubble'
            cartNumber.innerHTML = `
              <span aria-hidden="true">${cart.item_count}</span>
              <span class="visually-hidden">${cart.item_count} items</span>
            `
            cartIconBubble.appendChild(cartNumber)
          } else {
            cartCountBubble.querySelectorAll('span[aria-hidden="true"]').forEach(count => {
              count.textContent = cart.item_count.toString()
            })
          }
          ;(cartIconBubble as HTMLElement).click()
        }

        const cartNotificationOverlay = document.getElementById('cart-notification-Overlay')
        if (cartNotificationOverlay) {
          cartNotificationOverlay.addEventListener('click', () => {
            if (cartDrawer) {
              cartDrawer.classList.remove('active')
            }
            document.body.classList.remove('overflow-hidden')
          })
        }

        await callback?.()
      }
    })
    .catch(error => console.error('Error fetching cart notification:', error))
}

// Empire theme
async function handleEmpireTheme(cart: any, callback?: () => Promise<void> | void): void {
  const countEvent = new CustomEvent('cartcount:update', {
    detail: cart,
  })
  window.dispatchEvent(countEvent)

  setTimeout(async () => {
    await callback?.()
  }, 400)
}

// Handmade theme
async function handleHandmadeTheme(addedItemRes: any, cart: any, callback?: () => Promise<void> | void): void {
  fetch('/?sections=cart-notification-product,cart-notification-button,cart-icon-bubble')
    .then(response => response.json())
    .then(async sections => {
      addedItemRes.sections = sections

      const cartDrawer = document.querySelector('cart-notification') as any
      if (cartDrawer && typeof cartDrawer.renderContents === 'function') {
        cartDrawer.renderContents(addedItemRes)
      }

      const countInCart = document.querySelector('.cart-notification__count-value')
      if (countInCart) {
        countInCart.innerHTML = cart.item_count.toString()
      }

      const totalPrice = document.querySelector('.totals__subtotal-value')
      if (totalPrice) {
        totalPrice.innerHTML = `${(cart.total_price / 100).toFixed(2)} ${cart.currency}`
      }

      await callback?.()
    })
    .catch(error => console.error('Error fetching sections:', error))
}

// Canopy theme
async function handleCanopyTheme(callback?: () => Promise<void> | void) {
  await (document.querySelector('cart-drawer') as any)?.refreshCartDrawer()
  await (document.querySelector('cart-items') as any)?.refreshCartItems()

  await callback?.()
}

// Speedfly theme
async function handleSpeedflyTheme(cart: any, callback?: () => Promise<void> | void): void {
  const miniCart = document.querySelector('mini-cart') as any
  if (miniCart && typeof miniCart.generateDom === 'function') {
    miniCart.generateDom(cart)
  }

  await callback?.()
}

//Broadcast theme
async function handleBroadcastTheme(callback?: () => Promise<void> | void) {
  await (document.querySelector('cart-items') as any)?.getCart()

  await callback?.()
}

// Debut theme
let debutStore: any = null
async function handleThemeDebut(addedItemRes: any, callback?: () => Promise<void> | void) {
  if (!debutStore) {
    debutStore = new window.theme.Product()
  }
  await debutStore._setupCartPopup(addedItemRes)

  await callback?.()
}

// Venue theme
async function handleThemeVenue(addedItemRes: any, callback?: () => Promise<void> | void) {
  await window.theme.cart.store.getState().add(addedItemRes)

  await callback?.()
}

// Parallax theme
async function handleThemeParallax(cart: any, callback?: () => Promise<void> | void) {
  window.refreshCart && (await window.refreshCart(cart))

  await callback?.()
}

// Current Site theme
async function handleThemeCurrentSite(callback?: () => Promise<void> | void) {
  window.ajaxCart.init({
    formSelector: '.add-to-cart__form',
    cartContainer: '#CartContainer',
    addToCartSelector: '.add-to-cart',
    enableQtySelectors: true,
    moneyFormat: window.theme.strings.moneyFormat,
  })

  await callback?.()
}

// Exclusive theme
async function handleThemeExclusive(callback?: () => Promise<void> | void) {
  const event = new CustomEvent('added.ajaxProduct', {
    bubbles: true,
    cancelable: true,
  })
  document.body.dispatchEvent(event)

  setTimeout(async () => {
    await callback?.()
  }, 400)
}

// Theme Editions
async function handleThemeEditions(cart: any, callback?: () => Promise<void> | void) {
  const cartAmountWrap = document.querySelector('[data-header-cart-count]')
  if (cartAmountWrap) {
    cartAmountWrap.innerHTML = `(${cart.item_count})`
  }

  await callback?.()
}

async function handleThemePacific(cart: any, callback?: () => Promise<void> | void) {
  window.$('.cart-item-count').html(cart.item_count)
  window.$('.header-tools-cart').addClass('cart-has-content')

  await callback?.()
}

async function handleThemeStartup(cart: any, callback?: () => Promise<void> | void) {
  document.dispatchEvent(
    new CustomEvent('cart:count', {
      detail: {
        count: cart.item_count,
      },
    })
  )

  setTimeout(async () => {
    await callback?.()
  }, 400)
}

async function handleThemeReach(cart: any, callback?: () => Promise<void> | void) {
  document.querySelectorAll('[data-cart-count]').forEach(el => (el.innerHTML = cart.item_count))

  await callback?.()
}

async function handleThemeVogue(cart: any, callback?: () => Promise<void> | void) {
  document.querySelectorAll('[data-cart-count]').forEach(el => (el.innerHTML = cart.item_count))

  await callback?.()
}

async function handleGroupThoughtThemePartner(cart: any, callback?: () => Promise<void> | void) {
  document.dispatchEvent(new CustomEvent('theme:cart:change', { detail: { cart: cart } }))
  document.querySelector('[data-drawer="drawer-cart"]')?.dispatchEvent(new CustomEvent('theme:drawer:open'))

  await callback?.()
}

// Timber theme
async function handleTimberTheme(cart: any, callback?: () => Promise<void> | void) {
  await window.ajaxCart.cartUpdateCallback(cart)

  await callback?.()
}

// Blum theme
async function handleBlumTheme(res: any, callback?: () => Promise<void> | void) {
  typeof window.SHTHelper.forceUpdateCartStatus === 'function' && (await window.SHTHelper.forceUpdateCartStatus(res))

  await callback?.()
}

const listQueryRefreshCart = windowFunctionCustom().LIST_QUERY_REFRESH_CART
  ? windowFunctionCustom().LIST_QUERY_REFRESH_CART(EHtmlSelectors.SELECTOR_REPLACE)
  : EHtmlSelectors.SELECTOR_REPLACE

// Helper function to get the old elements from the DOM
function getOldElements(): Element[] {
  return Array.from(document.querySelectorAll(listQueryRefreshCart))
}

// Helper function to reload the page
function reloadPage(): void {
  window.location.reload()
}

// Helper function to fetch new HTML and extract target elements
function fetchNewElements(): Promise<Element[]> {
  const url = `${window.location.pathname}${window.location.search}`
  return fetch(url)
    .then(response => response.text())
    .then((text: string) => {
      const parser = new DOMParser()
      const newDoc = parser.parseFromString(text, 'text/html')
      return Array.from(newDoc.querySelectorAll(listQueryRefreshCart))
    })
}

// Helper function to update an element using morphdom
function updateElement(oldEl: Element, newEl: Element): void {
  morphdom(oldEl, newEl, {
    onBeforeElUpdated: (fromEl: any, toEl: any): boolean => {
      // Function to sanitize outerHTML by removing class attributes
      function sanitizeOuterHTML(html: string): string {
        // Create a temporary div to hold the HTML
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = html

        // Remove class attributes from all elements inside the div
        tempDiv.querySelectorAll('*').forEach(el => el.removeAttribute('class'))

        // Return sanitized HTML as a string
        return tempDiv.innerHTML
      }

      // Get the sanitized outerHTML for both elements
      const sanitizedFromHTML = sanitizeOuterHTML(fromEl.outerHTML)
      const sanitizedToHTML = sanitizeOuterHTML(toEl.outerHTML)
      // Compare sanitized outerHTMLs (ignoring class attributes)
      return sanitizedFromHTML !== sanitizedToHTML
    },
    onBeforeNodeDiscarded: (node: Node): boolean => true,
    onBeforeNodeAdded: (node: Node): Node => {
      console.log('node2', node)
      if (windowFunctionCustom().ADD_NODE_CUSTOMIZE) {
        return windowFunctionCustom().ADD_NODE_CUSTOMIZE(node)
      }
      return node
    },
  })
}

// Helper function to trigger clicks on cart links if not on the cart page
function clickCartLinks(): void {
  const cartLinks: Element[] = Array.from(document.querySelectorAll('a[href="/cart"]'))
  cartLinks.forEach(link => {
    if (!window.location.pathname.includes('/cart')) {
      ;(link as HTMLAnchorElement).click()
    }
  })
}

// Other theme
async function handleFallBackUpdateWithHtml(callback?: () => Promise<void> | void) {
  try {
    const oldElements = getOldElements()

    if (oldElements.length === 0) {
      reloadPage()
    } else {
      fetchNewElements()
        .then(async newElements => {
          // Clone new elements to prevent mutations
          const clonedNewElements = newElements.map(el => el.cloneNode(true) as Element)

          // If the number of elements mismatches, reload the page
          if (oldElements.length !== clonedNewElements.length) {
            reloadPage()
            return
          }

          // Update each old element with the corresponding new element
          oldElements.forEach((oldEl, index) => {
            updateElement(oldEl, clonedNewElements[index])
          })

          // Trigger clicks on cart links if necessary
          !windowFunctionCustom().DONT_CLICK_CART_ICON_WHEN_UPDATE && clickCartLinks()

          await callback?.()
        })
        .catch(error => console.error('Failed to update cart Impact Theme', error))
    }
  } catch (error) {
    console.error(error)
  }
}

// If theme is not included in this list,
// Custom function updateCart to window.__onetick_store__.handleUpdateCartAfterATC
export default async function handleUpdateCart(addedItemRes: any, cart: any, callback?: () => Promise<void> | void) {
  try {
    if (typeof window.__onetick_store__?.handleUpdateCartAfterATC === 'function') {
      return window.__onetick_store__.handleUpdateCartAfterATC(addedItemRes, cart)
    }

    const themeName = window.Shopify.theme.name
    if (windowFunctionCustom().USING_FALLBACK_REFRESH_CART) {
      await handleFallBackUpdateWithHtml(callback)
      return
    }

    publish(EPubSubEvents.CART_UPDATE, cart)

    switch (true) {
      case /Impact/i.test(themeName):
        await handleImpactTheme(cart, callback)
        break
      case /Athens/i.test(themeName):
        await handleAthensTheme(cart, callback)
        break
      case /Alto/i.test(themeName):
        await handleAltoTheme(callback)
        break
      case /Debutify/i.test(themeName):
        await handleDebutifyTheme(callback)
        break
      case /Avone/i.test(themeName):
        await handleAvoneTheme(callback)
        break
      case /Gecko|Kalles/i.test(themeName):
        await handleGeckoTheme(addedItemRes, callback)
        break
      case /Rebranding/i.test(themeName):
        await handleRebrandingTheme(cart, callback)
        break
      case /Flow/i.test(themeName):
        await handleFlowTheme(cart, callback)
        break
      case /Showtime/i.test(themeName):
        await handleShowtimeTheme(cart, callback)
        break
      case /Envy/i.test(themeName):
        await handleEnvyTheme(cart, callback)
        break
      case /Marker/i.test(themeName):
        await handleMarkerTheme(callback)
        break
      case /Express/i.test(themeName):
        await handleExpressTheme(addedItemRes, callback)
        break
      case /Impulse/i.test(themeName):
        await handleImpulseTheme(callback)
        break
      case /Focal/i.test(themeName):
        await handleFocalTheme(cart, callback)
        break
      case /Modular/i.test(themeName):
        await handleModularTheme(callback)
        break
      case /Foodie/i.test(themeName):
        await handleFoodieTheme(cart, callback)
        break
      case /Warehouse/i.test(themeName):
        await handleWarehouseTheme(addedItemRes, callback)
        break
      case /Lammer/i.test(themeName):
        await handleLammerTheme(addedItemRes, callback)
        break
      case /Minimog/i.test(themeName):
        await handleMinimogTheme(cart, addedItemRes, callback)
        break
      case /Furns - Furniture Shopify/i.test(themeName):
        await handleFurnTheme(addedItemRes, cart, callback)
        break
      case /Quark/i.test(themeName):
        await handleQuarkTheme(cart, callback)
        break
      case /Launch/i.test(themeName):
        await handleLaunchTheme(cart, callback)
        break
      case /Stockholm/i.test(themeName):
        await handleStockholmTheme(cart, callback)
        break
      case /Dawn|Craft|Taste|Refresh|Sense|Origin|Spotlight|Crave|Publisher|Colorblock|Studio|Ride|Horizon/i.test(
        themeName
      ):
        await handleFreeShopifyTheme(addedItemRes, callback)
        break
      case /Providence/i.test(themeName):
        await handleProvinceTheme(cart, callback)
        break
      case /Motion/i.test(themeName):
        await handleMotionTheme(cart, callback)
        break
      case /Ella/i.test(themeName):
        await handleEllaTheme(callback)
        break
      case /Be Yours/i.test(themeName):
        await handleBeYoursTheme(addedItemRes, callback)
        break
      case /Handmade/i.test(themeName):
        await handleHandmadeTheme(addedItemRes, cart, callback)
        break
      case /Empire/i.test(themeName):
        await handleEmpireTheme(cart, callback)
        break
      case /Speedfly/i.test(themeName):
        await handleSpeedflyTheme(cart, callback)
        break
      case /Canopy/i.test(themeName):
        await handleCanopyTheme(callback)
        break
      case /Turbo/i.test(themeName):
        await handleTurboTheme(cart, callback)
        break
      case /Emerge/i.test(themeName):
        await handleEmergeTheme(cart, callback)
        break
      case /Broadcast/i.test(themeName):
        await handleBroadcastTheme(callback)
        break
      case /Debut/i.test(themeName):
        await handleThemeDebut(addedItemRes, callback)
        break
      case /Venue/i.test(themeName):
        await handleThemeVenue(cart, callback)
        break
      case /Parallax/i.test(themeName):
        await handleThemeParallax(cart, callback)
        break
      case /Current Site|CurrentSite/i.test(themeName):
        await handleThemeCurrentSite(callback)
        break
      case /Exclusive/i.test(themeName):
        await handleThemeExclusive(callback)
        break
      case /Editions/i.test(themeName):
        await handleThemeEditions(cart, callback)
        break
      case /Pacific/i.test(themeName):
        await handleThemePacific(cart, callback)
        break
      case /Startup/i.test(themeName):
        await handleThemeStartup(cart, callback)
        break
      case /Reach/i.test(themeName):
        await handleThemeReach(cart, callback)
        break
      case /Vogue/i.test(themeName):
        await handleThemeVogue(cart, callback)
        break
      case /Pipeline|Story/i.test(themeName):
        await handleGroupThoughtThemePartner(cart, callback)
        break
      case /Timber/i.test(themeName):
        await handleTimberTheme(cart, callback)
        break
      case /Blum/i.test(themeName):
        await handleBlumTheme(addedItemRes, callback)
        break
      default:
        await handleFallBackUpdateWithHtml(callback)
        break
    }
  } catch (error) {
    console.error('[OneTick]', error)
  }
}

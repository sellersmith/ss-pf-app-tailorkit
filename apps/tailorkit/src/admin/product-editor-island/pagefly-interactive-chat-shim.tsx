import React from 'react'

type TailorKitComponent = React.ComponentType<Record<string, unknown>>

/**
 * PageFly admin owns support/chat surfaces. TailorKit copied routes should not
 * boot TailorKit InteractiveChat, reward coupon, or Crisp follow-up APIs.
 */
export function withInteractiveChat(Component: TailorKitComponent): TailorKitComponent {
  return function PageFlyTailorKitInteractiveChatShim(props: Record<string, unknown>) {
    return <Component {...props} />
  }
}

export default withInteractiveChat

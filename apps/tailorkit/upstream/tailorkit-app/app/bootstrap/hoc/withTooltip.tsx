import { Tooltip } from '@shopify/polaris'
import type { ComponentClass, ComponentProps, FunctionComponent, ReactNode } from 'react'

/**
 * Higher-order component to wrap a component with a Shopify Polaris Tooltip.
 *
 * Usage:
 * const ButtonWithTooltip = withTooltip(Button)
 * <ButtonWithTooltip tooltipContent="Info" tooltipProps={{ preferredPosition: 'above' }} />
 */
export type WithTooltipOptions<P> = {
  /**
   * Tooltip content or a function returning content based on wrapped component props
   */
  tooltipContent?: ReactNode | ((props: P) => ReactNode)
  /**
   * Toggle tooltip on/off. Defaults to true
   */
  tooltipEnabled?: boolean
  /**
   * Additional Polaris Tooltip props (content and children are controlled by HOC)
   */
  tooltipProps?: Omit<ComponentProps<typeof Tooltip>, 'content' | 'children'>
}

export default function withTooltip<P extends object>(Component: FunctionComponent<P> | ComponentClass<P>) {
  function WithTooltip(props: P & WithTooltipOptions<P>) {
    const { tooltipContent, tooltipEnabled = true, tooltipProps, ...rest } = props as P & WithTooltipOptions<P>

    const content: ReactNode | undefined
      = typeof tooltipContent === 'function' ? (tooltipContent as (p: P) => ReactNode)(props as P) : tooltipContent

    const isDisabled = Boolean((rest as unknown as { disabled?: boolean })?.disabled)
    const activator = <Component {...(rest as P)} />

    if (!tooltipEnabled || !content) {
      return activator
    }

    return (
      <Tooltip content={content} {...(tooltipProps || {})}>
        {isDisabled ? <span>{activator}</span> : activator}
      </Tooltip>
    )
  }

  WithTooltip.displayName = `WithTooltip(${Component.displayName || Component.name || 'Component'})`

  return WithTooltip
}

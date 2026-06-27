import { type ComponentType } from 'react'
import { Fragment } from 'react/jsx-runtime'
import { useGroupProductBase } from '~/stores/modules/integration/integration'
import type { VariantIntegration } from '~/types/integration'
import { useEditorParams } from './hooks/useEditorParams'

export interface WithVariantsProps {
  variants: VariantIntegration[]
  mockupId: string
}

// eslint-disable-next-line operator-linebreak
const withMockup = <P extends WithVariantsProps>(
  Component: ComponentType<P>,
  extraProps?: { id?: string; className?: string; style?: React.CSSProperties }
) => {
  const WrappedComponent = (props: Omit<P, keyof WithVariantsProps>) => {
    const { mockupId } = useEditorParams()
    const groupProductBase = useGroupProductBase()

    // Get variants for this specific mockup (memoized separately to prevent stale closures)
    const mockupVariants = mockupId ? groupProductBase[mockupId] : undefined

    // Use mockupVariants array directly - no need for extra useMemo
    // The groupProductBase already memoizes, and this is just array lookup
    const variants = mockupVariants || []

    if (!mockupId || !mockupVariants) {
      return extraProps ? <div {...extraProps} /> : <Fragment />
    }

    return <Component {...(props as P)} variants={variants} mockupId={mockupId} />
  }

  WrappedComponent.displayName = `WithMockup(${Component.displayName || Component.name || 'Component'})`

  return WrappedComponent
}

export default withMockup

import type { ButtonProps } from '@shopify/polaris'

export interface ISetupGuideItem {
  id: string
  title: string | React.ReactNode
  description: React.ReactNode | string
  complete: boolean
  primaryButton?: {
    content: string
    props: ButtonProps
  }
  secondaryButton?: {
    content: string
    props: ButtonProps
  }
}

export interface ISetupGuideProps {
  items: ISetupGuideItem[]
  showProgressBar?: boolean
  progressContent?: string
  onStepComplete?: (id: string) => Promise<void>
}

export interface ISetupGuideItemProps {
  item: ISetupGuideItem
  expanded: boolean
  allowMarkAsDone?: boolean
  tooltipContent?: {
    markAsDone: string
    markAsNotDone: string
  }
  primaryButton?: {
    content: string
    props: ButtonProps
  }
  secondaryButton?: {
    content: string
    props: ButtonProps
  }
  onComplete?: (id: string) => Promise<void>
  setExpanded: () => void
}

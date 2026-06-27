import type { ReactElement } from 'react'

export interface BottomSheet {
  drawerKey?: string
  level?: number
  isDefault?: boolean
  override?: string
  defaultPrevious?: string | null
  expandOnActive?: boolean
  bouncingOnShow?: boolean
  goBackOnTapHeader?: boolean
  defaultClose?: boolean
  [key: string]: any
}

export type ActionProps =
  | {
      content?: string
      action?: () => void
      loading?: boolean
      disabled?: boolean
      icon?: ReactElement
    }
  | { action: string | string[]; onAction: () => void; disabled?: boolean; loading?: boolean; icon?: ReactElement }

export interface BottomSheetDrawerProps extends BottomSheet {
  id?: string
  width?: string
  title?: React.ReactNode | string
  children?: React.ReactNode
  filters?: React.ReactNode
  showFooter?: boolean
  scrollable?: boolean
  useBackdrop?: boolean
  footer?: React.ReactNode
  primaryAction?: ActionProps | React.ReactNode
  secondaryAction?: ActionProps | React.ReactNode
  customBackDrop?: React.ReactNode
  autoBackAction?: boolean
  onBack?: () => void
  actions?: React.ReactNode
  lazyRender?: boolean
  bodyStyles?: React.CSSProperties
}

export interface ActiveBottomSheet extends Pick<BottomSheet, 'expandOnActive' | 'level'> {
  drawerKey: string
  previous?: ActiveBottomSheet
  [key: string]: any
}

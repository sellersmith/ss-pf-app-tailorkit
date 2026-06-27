import type { ECardPlacement } from './constants'

export interface ITourGuideProps {
  /**
   * Data flow
   */
  flow: GuidedTourFlow

  /**
   * Start step id
   */
  startStepId?: string
  /**
   * Active status of tour guide
   */
  active?: boolean

  /**
   * Overlay color. (default: rgba(0, 0, 0, 0.4))
   */
  overlayColor?: string

  /**
   * Whether to allow closing the popover by clicking on the backdrop. (default: true)
   */
  allowClose?: boolean

  /**
   * Whether to allow keyboard navigation. (default: true)
   */
  allowKeyboardControl?: boolean

  /**
   * Custom class for popover
   */
  popoverClass?: string

  /**
   * Distance between the popover and the highlighted element. (default: 10)
   */
  popoverOffset?: number

  /**
   * Whether to show the progress text in popover. (default: false)
   */
  showProgress?: boolean

  /**
   * Whether to render the Skip button. (default: true)
   */
  showSkip?: boolean

  /**
   * Label for the Skip button. (default: 'Skip')
   */
  skipLabel?: string

  /**
   * Can interact with highlighted element. (default: true)
   */
  canInteractHighlight?: boolean

  onNext: {
    content?: string
    action: (stepId: string) => void
  }
  onPrev?: {
    content?: string
    action: () => void
  }

  /** Finish the tour */
  onFinish: () => void
  /**
   * Skip the tour callback, this function will be called when close popover, click backdrop and run the last step
   */
  onSkip?: () => void

  /**
   * Callback when user clicks "Don't show again" button.
   * Should persist the dismissal (e.g., set isFinished: true in UserJourney).
   */
  onDontShowAgain?: () => void

  /**
   * Whether to show the animated arrow
   */
  showArrow?: boolean

  /**
   * Arrow configuration
   */
  arrowConfig?: TourGuideArrowProps
}

/**
 * Defines the dimensions and position of a highlighted element
 */
export interface HighlightRect {
  x: number
  y: number
  width: number
  height: number

  rx?: number
  ry?: number

  padding?: number | [number, number, number, number]

  disableActiveInteraction?: boolean
}

/**
 * Props for the semi-transparent backdrop that highlights specific elements
 * @property canInteractHighlight - Whether user can interact with highlighted element
 * @property highlightRect - Dimensions of the highlighted area
 * @property nextStep - Function to proceed to next tour step
 */
export interface TourGuideBackdropProps {
  canInteractHighlight?: boolean
  highlightRect: HighlightRect | null
}

/** Type of disable until function */
export type disableUntilFnc = () => boolean | Promise<boolean>

/**
 * Represents a single step in the guided tour
 * @property targetId - ID of the element to highlight
 * @property placement - Position of the tour card relative to highlighted element
 */
export interface TourGuideStep {
  /** Id of step */
  id: string
  /** Element selector */
  element: string
  /** Title of popover */
  title: string
  /** Main content for describing of popover */
  content?: string
  /** Label for the Next button in this step (overrides global onNext.content) */
  nextLabel?: string
  /** Label for the Pre button in this step (overrides global onPre.content) */
  preLabel?: string
  /** Whether to show the close (X) button in this step (default: true) */
  showClose?: boolean
  /** Help text for popover */
  helpText?: string
  /** Caret placement */
  placement?: ECardPlacement
  /** Delay move card time. Default is 0 */
  delay?: number
  /** Disable user scrollable */
  disableUserScrollable?: boolean
  /** Distance between the highlighted element and the cutout. (default: 10) */
  stagePadding?: HighlightRect['padding']
  /** Radius of the cutout around the highlighted element. (default: 5) */
  stageRadius?: number
  /**
   * Recursive query selector number.
   * It will query the element until finding out, timeout of each query if 150ms.
   * The recursiveQuery only run once it's defined otherwise it will query element by default action.
   */
  recursiveQuery?: number
  /**
   * Recursive query selector element.
   * It will query the element until finding out, timeout of each query if 150ms.
   * The recursiveQuery only run once it's defined otherwise it will query element by default action.
   */
  recursiveElement?: string
  /**
   * @experimental
   * Do next action if triggering element selector.
   * This is useful for step that not need click "Next" button to move to next step.
   * Once the element is triggered, it will move to next step.
   *
   * This property is experimental. The trigger progress event should be synchronous,
   * because we currently can't detect the event by default event to wait and run synchronous if this event is asynchronous.
   * */
  autoProgressive?: boolean | string[]

  /**
   * Skip this step when the condition is met.
   */
  skipThisStepWhen?: () => boolean | Promise<boolean>

  /** Whether to disable interaction with the highlighted element. (default: false) */
  disableActiveInteraction?: HighlightRect['disableActiveInteraction']
  /**
   * Whether to show the animated arrow for this step
   */
  arrowSelector?: string

  /**
   * Arrow configuration for this specific step
   */
  arrowConfig?: TourGuideArrowProps
  /** Provider a function for disabling next action until meeting a condition */
  disableNextUntil?: disableUntilFnc
  /** Provider a function for disabling pre action until meeting a condition */
  disablePreUntil?: disableUntilFnc
  /** An action to run before mounting the step (supports async) */
  onBeforeMount?: () => void | Promise<void>
  /** Next action of step */
  onNext?: () => void
  /** Pre action of step */
  onPre?: () => void | boolean
  /** Continue tour action */
  onContinueTour?: () => void
  /** Skip tour action */
  onSkip?: () => void
}

/**
 * Represents a complete guided tour flow
 */
export interface GuidedTourFlow {
  id: string
  steps: TourGuideStep[]
}

/**
 * Basic position coordinates for UI elements
 */
export interface TourGuidePosition {
  top?: number
  left?: number
}

/**
 * Props for the tour card component that displays step information
 * @property progress - Text showing current progress (e.g. "2 of 5")
 * @property position - Absolute positioning of the card
 * @property cardRef - Reference to the card's DOM element
 * @property renderNavigationButtons - Custom navigation buttons
 */
export interface TourGuideCardProps {
  tourId: string
  stepIndex: number
  stepId: string | number
  steps: TourGuideStep[]
  title?: string
  content?: string
  helpText?: string
  progress?: string
  position: {
    top?: number
    left?: number
    bottom?: number
    right?: number
  }
  cardRef?: React.RefObject<HTMLDivElement>
  onClose?: () => void
  renderNavigationButtons?: React.ReactNode
}

/**
 * Props for the minimized tour button shown after tour is skipped
 */
export interface GuidedTourMinimizedProps {
  isSkipped: boolean
  startTour: () => void
}

export interface TourGuideArrowProps {
  color?: string
  size?: 'small' | 'medium' | 'large'
  animationDuration?: number
  animationStyle?: 'bounce' | 'pulse' | 'draw'
  startPosition?: 'bottom' | 'right' | 'left' | 'top' | 'auto'
  offset?: [number, number]
  placement?: ECardPlacement
  curveIntensity?: number
}

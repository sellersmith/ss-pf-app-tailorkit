import type { MinimalTransformState } from '../types/editor-types'

/**
 * History Manager for undo/redo operations
 * Uses minimal state objects with primitive values for memory efficiency
 */
export class HistoryManager {
  private stateHistory: MinimalTransformState[] = []
  private currentStateIndex = -1
  private readonly maxHistorySize = 30
  private isHistoryOperation = false
  private isInitializing = false

  /**
   * Constructor
   */
  constructor() {
    this.reset()
  }

  /**
   * Save current state to history
   * @param state Current state to save
   * @param skipHistory Whether to skip saving to history
   */
  public saveState(state: MinimalTransformState, skipHistory = false): void {
    // Don't save state during initialization, history operations, or if explicitly skipped
    if (this.isHistoryOperation || this.isInitializing || skipHistory) return

    // Ensure we're always working with a clean copy of the state
    const stateCopy = { ...state }

    // If we're not at the end of history, truncate history
    if (this.currentStateIndex < this.stateHistory.length - 1) {
      this.stateHistory = this.stateHistory.slice(0, this.currentStateIndex + 1)
    }

    // Never save duplicate states
    const currentState = this.getCurrentState()
    if (
      currentState
      && currentState.x === stateCopy.x
      && currentState.y === stateCopy.y
      && currentState.rotation === stateCopy.rotation
      && currentState.width === stateCopy.width
      && currentState.height === stateCopy.height
    ) {
      return
    }

    // Add current state to history
    this.stateHistory.push(stateCopy)
    this.currentStateIndex = this.stateHistory.length - 1

    // Limit history size
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory = this.stateHistory.slice(this.stateHistory.length - this.maxHistorySize)
      this.currentStateIndex = this.stateHistory.length - 1
    }
  }

  /**
   * Go back to previous state
   * @returns State to apply and success flag
   */
  public undo(): { state: MinimalTransformState | null; success: boolean } {
    if (this.currentStateIndex <= 0) {
      return { state: null, success: false }
    }

    this.isHistoryOperation = true
    this.currentStateIndex--
    const state = this.stateHistory[this.currentStateIndex]
    this.isHistoryOperation = false

    return { state, success: true }
  }

  /**
   * Go forward to next state
   * @returns State to apply and success flag
   */
  public redo(): { state: MinimalTransformState | null; success: boolean } {
    if (this.currentStateIndex >= this.stateHistory.length - 1) {
      return { state: null, success: false }
    }

    this.isHistoryOperation = true
    this.currentStateIndex++
    const state = this.stateHistory[this.currentStateIndex]
    this.isHistoryOperation = false

    return { state, success: true }
  }

  /**
   * Check if undo is available
   */
  public canUndo(): boolean {
    return this.currentStateIndex > 0
  }

  /**
   * Check if redo is available
   */
  public canRedo(): boolean {
    return this.currentStateIndex < this.stateHistory.length - 1
  }

  /**
   * Get current state
   */
  public getCurrentState(): MinimalTransformState | null {
    if (this.currentStateIndex < 0 || this.stateHistory.length === 0) {
      return null
    }
    return this.stateHistory[this.currentStateIndex]
  }

  /**
   * Reset history
   */
  public reset(): void {
    this.stateHistory = []
    this.currentStateIndex = -1
  }

  /**
   * Set initialization mode
   */
  public setInitializing(initializing: boolean): void {
    this.isInitializing = initializing
  }

  /**
   * Check if currently executing a history operation
   */
  public inHistoryOperation(): boolean {
    return this.isHistoryOperation
  }
}

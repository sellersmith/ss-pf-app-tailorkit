import type { CharmBuilderAction, CharmBuilderState } from './types'

export type CharmBuilderSubscriber = (state: CharmBuilderState) => void

const createInitialState = (): CharmBuilderState => ({
  assignments: {},
  positions: {},
  selectedSlotId: undefined,
  version: 0,
  updatedAt: Date.now(),
})

export class CharmBuilderStore {
  private state: CharmBuilderState
  private subscribers: Set<CharmBuilderSubscriber>
  private pendingPositions: Record<string, { x: number; y: number }> = {}
  private rafId: number | null = null

  constructor(initial?: Partial<CharmBuilderState>) {
    this.state = {
      ...createInitialState(),
      ...initial,
    }
    this.subscribers = new Set()
  }

  getState(): CharmBuilderState {
    return this.state
  }

  subscribe(subscriber: CharmBuilderSubscriber) {
    this.subscribers.add(subscriber)
    subscriber(this.state)
    return () => {
      this.subscribers.delete(subscriber)
    }
  }

  dispatch(action: CharmBuilderAction) {
    const nextState = this.reduce(this.state, action)
    if (nextState !== this.state) {
      this.state = nextState
      this.subscribers.forEach(listener => listener(this.state))
    }
  }

  queuePositionUpdate(slotId: string, position: { x: number; y: number }) {
    this.pendingPositions[slotId] = position
    if (this.rafId !== null) return

    this.rafId = window.requestAnimationFrame(() => {
      this.dispatch({ type: 'batch-positions', positions: { ...this.pendingPositions } })
      this.pendingPositions = {}
      this.rafId = null
    })
  }

  private reduce(state: CharmBuilderState, action: CharmBuilderAction): CharmBuilderState {
    switch (action.type) {
      case 'assign': {
        return {
          ...state,
          assignments: { ...state.assignments, [action.slotId]: action.charmId },
          selectedSlotId: action.slotId,
          version: state.version + 1,
          updatedAt: Date.now(),
        }
      }
      case 'remove': {
        const assignments = { ...state.assignments }
        delete assignments[action.slotId]
        return {
          ...state,
          assignments,
          selectedSlotId: state.selectedSlotId === action.slotId ? undefined : state.selectedSlotId,
          version: state.version + 1,
          updatedAt: Date.now(),
        }
      }
      case 'select': {
        if (action.slotId === state.selectedSlotId) return state
        return {
          ...state,
          selectedSlotId: action.slotId,
          version: state.version + 1,
          updatedAt: Date.now(),
        }
      }
      case 'set-position': {
        return {
          ...state,
          positions: { ...state.positions, [action.slotId]: action.position },
          version: state.version + 1,
          updatedAt: Date.now(),
        }
      }
      case 'batch-positions': {
        return {
          ...state,
          positions: { ...state.positions, ...action.positions },
          version: state.version + 1,
          updatedAt: Date.now(),
        }
      }
      default:
        return state
    }
  }
}

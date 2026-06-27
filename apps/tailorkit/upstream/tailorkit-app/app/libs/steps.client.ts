import cloneDeep from 'lodash/cloneDeep'

export interface Step {
  type: string
  id?: string
  timeStamp?: number
  fromData: any
  toData: any
  callback?: (target: any, props: string | symbol, value: any) => void
  /** Metadata for charm operations - tracks created/removed CHARM layers */
  charmMeta?: {
    /** Instance IDs of charm layers created in this step */
    createdInstanceIds?: string[]
    /** Instance IDs of charm layers removed in this step */
    removedInstanceIds?: string[]
    /** Product ID associated with the charm operation */
    productId?: string
    /** Full product ref for recreating charms on redo */
    productRef?: any
    /** Transform data for recreating charms on redo */
    transform?: any
    /** Parent CHARM_NODE layer ID */
    charmNodeId?: string
    /** Trimmed transforms from UPDATE_CHARM_MAX (for undo restoration) */
    trimmedTransforms?: Array<{ productId: string; transform: any }>
  }
}

type Stage = {
  steps: any[]
  currentStep: number
  savedStep: number
}

type ViewUndoRedoProxy = {
  undo: boolean
  redo: boolean
  currentStep: number
  isPlayback: boolean
}

export const stage: Stage = {
  steps: [],
  currentStep: -1,
  savedStep: -1,
}

// Add listeners for state changes
type UndoRedoListener = () => void
const undoRedoListeners: Set<UndoRedoListener> = new Set()

export const subscribeToUndoRedoChanges = (listener: UndoRedoListener): (() => void) => {
  undoRedoListeners.add(listener)
  return () => {
    undoRedoListeners.delete(listener)
  }
}

export const notifyUndoRedoListeners = () => {
  undoRedoListeners.forEach(listener => listener())
}

const viewUndoRedoProxy: ViewUndoRedoProxy = {
  undo: false,
  redo: false,
  currentStep: -1,
  isPlayback: true,
}

export const resetProxyUndoRedo = () => {
  stage.steps = []
  stage.savedStep = -1
  stage.currentStep = -1
  proxyUndoRedo.undo = false
  proxyUndoRedo.redo = false
  proxyUndoRedo.currentStep = -1
  proxyUndoRedo.isPlayback = true
  // Notify listeners about reset
  notifyUndoRedoListeners()
}

export const proxyUndoRedo = new Proxy(viewUndoRedoProxy, {
  get(obj: any, prop) {
    return obj[prop]
  },
  set(obj, prop, value) {
    obj[prop] = value

    if (typeof value !== 'boolean') {
      obj['undo'] = value > -1
      obj['redo'] = value >= -1 && stage.steps[value + 1] ? true : false

      setTimeout(() => {
        if (stage.steps[value]?.callback) {
          stage.steps[value].callback(obj, prop, value)
        }

        // Notify listeners about changes
        notifyUndoRedoListeners()
      })
    }

    return true
  },
})

export const addSteps = (step: Step, deepClone = true) => {
  const timeStamp = new Date().getTime()
  step.timeStamp = timeStamp
  clearAllRemainingSteps()
  proxyUndoRedo.currentStep++
  stage.currentStep++
  proxyUndoRedo.isPlayback = false

  // Clone data because updateState function modifies the inputs
  return stage.steps.push(deepClone ? cloneDeep(step) : step)
}

export const getStepById = (id: String) => {
  return stage.steps.find(step => step.id === id)
}

export const removeStepById = (id: String) => {
  const index = stage.steps.findIndex(step => step.id === id)
  return stage.steps.splice(index, 1)
}

export const getCurrentStep = () => {
  return stage.steps[stage.currentStep] || null
}

export const clearAllRemainingSteps = () => {
  return stage.steps.splice(stage.currentStep + 1, stage.steps.length)
}

export const clearAllSteps = () => {
  return stage.steps.splice(0, stage.steps.length)
}

export const printLastStep = () => {
  console.log('=== TailorKit step: ===', stage.steps[stage.steps.length - 1])
}

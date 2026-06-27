import { loadFeature } from '../../utils/feature-loader'
import type { KonvaFeatureModule } from '../../utils/feature-loader.types'
import type { LiveProductSnapshot } from '../../utils/live-data-adapter'
import type { CharmBuilderState, CharmNodeLayer, CharmSlotNode } from './types'
import type { CharmBuilderStore } from './store'

const DEFAULT_CANVAS_SIZE = 420

export type CharmCanvasConfig = {
  container: HTMLElement
  charmNode: CharmNodeLayer
  store: CharmBuilderStore
  t: (value: string) => string
}

type CanvasNodeEntry = {
  group: any
  circle: any
  label: any
  title: any
}

export class StorefrontCharmCanvas {
  private container: HTMLElement
  private charmNode: CharmNodeLayer
  private store: CharmBuilderStore
  private stage: any
  private layer: any
  private Konva: any
  private nodesBySlotId: Map<string, CanvasNodeEntry> = new Map()
  private unsubscribe: (() => void) | null = null
  private t: (value: string) => string

  constructor(config: CharmCanvasConfig) {
    this.container = config.container
    this.charmNode = config.charmNode
    this.store = config.store
    this.t = config.t
  }

  async init() {
    const konvaModule = await loadFeature<KonvaFeatureModule>('konva')
    const { Konva } = konvaModule
    this.Konva = Konva

    const { width, height } = this.getCanvasSize()
    this.stage = new Konva.Stage({
      container: this.container as HTMLDivElement,
      width,
      height,
    })
    this.layer = new Konva.Layer()
    this.stage.add(this.layer)

    this.renderNodes(this.store.getState(), {}, true)

    this.unsubscribe = this.store.subscribe(state => {
      this.renderNodes(state, {})
    })

    window.addEventListener('resize', this.handleResize)
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize)
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    if (this.stage) {
      this.stage.destroy()
      this.stage = null
    }
    this.nodesBySlotId.clear()
  }

  updateLiveData(
    state: CharmBuilderState,
    liveData: Record<string, LiveProductSnapshot>,
    loading: boolean,
    error?: string
  ) {
    this.renderNodes(state, liveData, loading, error)
  }

  private handleResize = () => {
    if (!this.stage) return
    const { width, height } = this.getCanvasSize()
    this.stage.width(width)
    this.stage.height(height)
    this.stage.draw()
  }

  private getCanvasSize() {
    const width = this.container.clientWidth || DEFAULT_CANVAS_SIZE
    const height = this.container.clientHeight || DEFAULT_CANVAS_SIZE
    return { width, height }
  }

  private renderNodes(
    state: CharmBuilderState,
    liveData: Record<string, LiveProductSnapshot>,
    loading = false,
    errorMessage?: string
  ) {
    if (!this.layer || !this.Konva) return

    if (loading || errorMessage) {
      this.layer.destroyChildren()
      this.nodesBySlotId.clear()

      if (errorMessage) {
        this.layer.add(
          this.createTextNode({
            text: this.t('kh-ng-th-t-i-d-li-u-live'),
            x: 16,
            y: 16,
            color: '#8e1f0b',
          })
        )
      } else {
        this.layer.add(
          this.createTextNode({
            text: this.t('ang-t-i-canvas'),
            x: 16,
            y: 16,
            color: '#6d7175',
          })
        )
      }

      this.layer.draw()
      return
    }

    this.charmNode.nd.forEach(slot => {
      const position = state.positions[slot.i] || { x: slot.x, y: slot.y }
      const assignedCharm = state.assignments[slot.i]
      const isSelected = state.selectedSlotId === slot.i

      const existing = this.nodesBySlotId.get(slot.i)
      if (existing) {
        this.updateNode(existing, slot, position, assignedCharm, liveData, isSelected)
      } else {
        const entry = this.createSlotNode(slot, position.x, position.y, assignedCharm, liveData, isSelected)
        this.nodesBySlotId.set(slot.i, entry)
        this.layer.add(entry.group)
      }
    })

    this.layer.draw()
  }

  private updateNode(
    entry: CanvasNodeEntry,
    slot: CharmSlotNode,
    position: { x: number; y: number },
    assignedCharm: string | undefined,
    liveData: Record<string, LiveProductSnapshot>,
    isSelected: boolean
  ) {
    entry.group.position(position)

    const assignedProduct = assignedCharm ? this.charmNode.lp.find(product => product.i === assignedCharm) : null
    const snapshot = assignedProduct ? liveData[assignedProduct.pid] : null

    const fill = snapshot?.available === false ? '#fed3d1' : assignedCharm ? '#aee9d1' : '#e4e5e7'
    const stroke = isSelected ? '#2c6ecb' : '#d0d3d8'

    entry.circle.fill(fill)
    entry.circle.stroke(stroke)
    entry.circle.strokeWidth(isSelected ? 3 : 2)
    entry.label.text(slot.l || '')
    entry.title.text(snapshot?.title || this.t('charm'))
  }

  private createSlotNode(
    slot: CharmSlotNode,
    x: number,
    y: number,
    assignedCharm: string | undefined,
    liveData: Record<string, LiveProductSnapshot>,
    isSelected: boolean
  ) {
    const group = new this.Konva.Group({ x, y, draggable: true })

    const assignedProduct = assignedCharm ? this.charmNode.lp.find(product => product.i === assignedCharm) : null
    const snapshot = assignedProduct ? liveData[assignedProduct.pid] : null

    const fill = snapshot?.available === false ? '#fed3d1' : assignedCharm ? '#aee9d1' : '#e4e5e7'
    const stroke = isSelected ? '#2c6ecb' : '#d0d3d8'

    const circle = new this.Konva.Circle({
      radius: 24,
      fill,
      stroke,
      strokeWidth: isSelected ? 3 : 2,
    })

    const label = new this.Konva.Text({
      text: slot.l || '',
      fontSize: 12,
      fill: '#202223',
      offsetX: 12,
      offsetY: -36,
    })

    const title = new this.Konva.Text({
      text: snapshot?.title || this.t('charm'),
      fontSize: 11,
      fill: '#202223',
      offsetX: 12,
      offsetY: 14,
    })

    group.add(circle)
    group.add(label)
    group.add(title)

    group.on('dragmove', () => {
      const position = group.position()
      this.store.queuePositionUpdate(slot.i, { x: position.x, y: position.y })
    })

    group.on('dragend', () => {
      const position = group.position()
      this.store.dispatch({ type: 'set-position', slotId: slot.i, position: { x: position.x, y: position.y } })
    })

    group.on('click', () => {
      this.store.dispatch({ type: 'select', slotId: slot.i })
    })

    return { group, circle, label, title }
  }

  private createTextNode({ text, x, y, color }: { text: string; x: number; y: number; color: string }) {
    return new this.Konva.Text({
      text,
      x,
      y,
      fontSize: 14,
      fill: color,
    })
  }
}

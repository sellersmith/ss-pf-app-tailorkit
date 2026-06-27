import { MCPClientCore, type MCPMessage } from './mcp-client-core'
import { DOMScanner } from './dom-scanner'
import { DOMActions } from './dom-actions'
import { StateManager, type ProductPersonalizerDOM } from './state-manager'

export class TailorKitMCPClient {
  private core: MCPClientCore
  private scanner: DOMScanner
  private actions: DOMActions
  private stateManager: StateManager
  private stateUpdateTimer: number | null = null

  constructor(origin: string, path: string, sessionId?: string) {
    console.log('🚀 Initializing TailorKit MCP Client...')

    this.core = new MCPClientCore(origin, path, sessionId)
    this.scanner = new DOMScanner()
    this.actions = new DOMActions()
    this.stateManager = new StateManager()

    this.setupEventHandlers()
    this.initialize()
  }

  private setupEventHandlers(): void {
    this.core.onConnected = clientId => {
      console.log(`🆔 MCP Connected with ID: ${clientId}`)
      // this.sendInitialState()
      // this.setupPeriodicStateUpdate()
    }

    this.core.onActionRequest = message => {
      this.handleActionRequest(message)
    }
  }

  private async initialize(): Promise<void> {
    try {
      await this.core.connect()
      console.log('✅ TailorKit MCP Client initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize MCP client:', error)
    }
  }

  // Action handling
  private async handleActionRequest(message: MCPMessage): Promise<void> {
    const { requestId, action, params } = message
    console.log(`🛠️ Executing MCP action: ${action}`)

    try {
      let result: any

      switch (action) {
        case 'getPersonalizerDom':
          result = await this.stateManager.getPersonalizerDOM()
          break

        case 'executePersonalizerDomOptions':
          result = this.stateManager.executePersonalizerDomOptions(params?.script, params?.recallGetPersonalizerDom)
          break

        // case 'getAvailableOptions':
        //   result = this.scanner.scanAvailableOptions(params?.category)
        //   break

        // case 'clickOption':
        //   result = await this.actions.clickOption(params?.selector)
        //   break

        // case 'selectOptions':
        //   result = await this.actions.selectMultipleOptions(params?.selectors || [])
        //   break

        // case 'navigateToStep':
        //   result = await this.actions.navigateToStep(params?.step)
        //   break

        // case 'getSelectionSummary':
        //   result = this.stateManager.getSelectionSummary()
        //   break

        // case 'searchOptions':
        //   result = this.scanner.searchElements(params?.query || '')
        //   break

        // case 'resetSelections':
        //   result = await this.actions.resetSelections(params?.category)
        //   break

        // case 'validateConfiguration':
        //   result = this.stateManager.validateConfiguration()
        //   break

        default:
          throw new Error(`Unknown MCP action: ${action}`)
      }

      console.log(`✅ MCP action ${action} completed`)
      this.core.sendActionResult(requestId!, true, result)

      // Update state after successful action
      // setTimeout(() => this.sendStateUpdate(), 200)
    } catch (error: any) {
      console.error(`❌ MCP action ${action} failed:`, error)
      this.core.sendActionResult(requestId!, false, undefined, error.message)
    }
  }

  // State management
  private sendInitialState(): void {
    // setTimeout(() => this.sendStateUpdate(), 500)
  }

  private sendStateUpdate(): void {
    if (!this.core.isClientConnected()) return

    this.stateManager
      .getPersonalizerDOM()
      .then(state => {
        this.core.sendStateUpdate(state)
      })
      .catch(error => {
        console.error('❌ Failed to send state update:', error)
      })
  }

  private setupPeriodicStateUpdate(): void {
    if (this.stateUpdateTimer) {
      clearInterval(this.stateUpdateTimer)
    }

    this.stateUpdateTimer = setInterval(() => {
      if (this.core.isClientConnected()) {
        this.sendStateUpdate()
      }
    }, 10000) as any // Every 10 seconds
  }

  // Public API
  getClientId(): string | null {
    return this.core.getClientId()
  }

  isClientConnected(): boolean {
    return this.core.isClientConnected()
  }

  getConnectionInfo(): any {
    return this.core.getConnectionInfo()
  }

  // Session management
  setSessionId(sessionId: string): void {
    this.core.setSessionId(sessionId)
  }

  disconnect(): void {
    if (this.stateUpdateTimer) {
      clearInterval(this.stateUpdateTimer)
      this.stateUpdateTimer = null
    }
    this.core.disconnect()
  }

  // Manual triggers
  manualStateUpdate(): void {
    this.sendStateUpdate()
  }

  // Debug methods
  async debugScan(): Promise<void> {
    console.log('🐛 MCP Debug scan:')
    const state = await this.stateManager.getPersonalizerDOM()
    console.log({
      connection: this.getConnectionInfo(),
      available: state.availableOptions.length,
      // selected: state.selectedOptions.length,
      // step: state.currentStep,
      // summary: state.selectionSummary,
      // validation: state.validationResult,
    })
  }

  async debugClick(selector: string): Promise<boolean> {
    console.log(`🐛 MCP Debug click: ${selector}`)
    return this.actions.clickOption(selector)
  }
}

// Auto-initialization
let clientInstance: TailorKitMCPClient | null = null

export function initializeTailorKitMCP(origin: string, path: string, sessionId?: string): TailorKitMCPClient | null {
  if (typeof window === 'undefined') {
    console.warn('TailorKit MCP Client requires browser environment')
    return null
  }

  if (clientInstance) {
    console.log('♻️ MCP Client already initialized')

    // Update session ID if provided and different
    if (sessionId) {
      clientInstance.setSessionId(sessionId)
    }

    return clientInstance
  }

  try {
    clientInstance = new TailorKitMCPClient(origin, path, sessionId)

    // Global access for debugging
    ;(window as any).tailorKitMCP = clientInstance
    ;(window as any).debugMCP = {
      scan: () => clientInstance?.debugScan(),
      click: (selector: string) => clientInstance?.debugClick(selector),
      state: () => clientInstance?.manualStateUpdate(),
      connection: () => clientInstance?.getConnectionInfo(),
    }

    console.log('✅ TailorKit MCP Client ready')
    console.log('🐛 Debug: window.debugMCP')

    return clientInstance
  } catch (error) {
    console.error('❌ MCP initialization failed:', error)
    return null
  }
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    clientInstance?.disconnect()
  })
}

// export { TailorKitMCPClient }
export type { ProductPersonalizerDOM }

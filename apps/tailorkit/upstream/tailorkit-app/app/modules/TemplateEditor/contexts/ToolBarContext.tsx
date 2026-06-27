import { useParams } from '@remix-run/react'
import type { ReactNode, SVGProps } from 'react'
import { createContext, useCallback, useContext } from 'react'
import { GridToolIcon, HandToolIcon, MoveToolIcon, RulerToolIcon } from '~/assets/icons'
import { DEFAULT_GRID_SIZE } from '~/components/canvas/Grid/constants'
import { useLocalStorage } from '~/utils/hooks/useLocalStorage'

export type ToolBarMode = 'move-tool' | 'hand-tool'
export type ToolBarQuickTool = 'ruler-tool' | 'grid-tool'

export interface ToolBarGridSettings {
  gridSize?: number
  gridMode?: 'fixed' | 'auto'
}

export type ToolBarSettings = {
  grid?: ToolBarGridSettings
}

export const TOOL_BAR_MODES: { id: ToolBarMode; icon: JSX.Element; label: string }[] = [
  {
    id: 'move-tool',
    icon: MoveToolIcon,
    label: 'move-tool',
  },
  {
    id: 'hand-tool',
    icon: HandToolIcon,
    label: 'hand-tool',
  },
]

export const TOOL_BAR_QUICK_TOOLS: {
  id: ToolBarQuickTool
  icon: JSX.Element | React.FC<SVGProps<SVGSVGElement>>
  iconPolaris: boolean
  label: string
  shortcut: string
  tone?: string
  tooltip?: string
}[] = [
  {
    id: 'ruler-tool',
    icon: RulerToolIcon,
    iconPolaris: false,
    label: 'ruler-tool',
    shortcut: 'Shift + R',
  },
  {
    id: 'grid-tool',
    icon: GridToolIcon,
    iconPolaris: false,
    label: 'grid-tool',
    shortcut: 'Shift + G',
  },
]

interface ToolBarState {
  mode: ToolBarMode
  quickTools: ToolBarQuickTool[]
  settings: ToolBarSettings
  dispatch: (action: { payload: any }) => void
}

export const ToolBarContext = createContext<ToolBarState>({
  mode: TOOL_BAR_MODES[0].id,
  quickTools: [],
  settings: {
    grid: {
      gridSize: DEFAULT_GRID_SIZE,
      gridMode: 'fixed',
    },
  },
  dispatch: () => {},
})

export function ToolBarProvider({ children }: { children: ReactNode }) {
  // Get the id of editor
  const { id } = useParams()
  const TOOL_BAR_STATE_KEY = `tailorkit-tool-bar-state-${id}`

  // Get the tool bar state from the local storage
  const [state, setState] = useLocalStorage(TOOL_BAR_STATE_KEY, {
    mode: TOOL_BAR_MODES[0].id,
    quickTools: [],
    settings: {
      grid: {
        gridSize: DEFAULT_GRID_SIZE,
        gridMode: 'fixed',
      },
    },
  })

  const dispatch = useCallback(
    (action: { payload: { mode?: ToolBarMode; quickTools?: ToolBarQuickTool[] } }) => {
      setState({
        ...state,
        ...action.payload,
      })
    },
    [setState, state]
  )

  return <ToolBarContext.Provider value={{ ...state, dispatch }}>{children}</ToolBarContext.Provider>
}

export function useToolBarState() {
  const context = useContext(ToolBarContext)
  if (context === undefined) {
    throw new Error('useToolBarState must be used within a ToolBarProvider')
  }
  return context
}

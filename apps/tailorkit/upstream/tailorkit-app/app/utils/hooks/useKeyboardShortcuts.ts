import { useMemo } from 'react'
import useDevices from './useDevice'
import type {
  KeyboardShortcutGroup,
  ProcessedShortcutGroup,
  Platform,
  ProcessedShortcutItem,
} from '~/types/keyboardShortcuts'

/**
 * Hook to process keyboard shortcuts based on the current platform
 * @param shortcuts Array of keyboard shortcut groups
 * @returns Processed shortcuts with platform-appropriate shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcutGroup[]): ProcessedShortcutGroup[] {
  const { isMacOS } = useDevices()

  const processedShortcuts = useMemo(() => {
    const platform: Platform = isMacOS ? 'mac' : 'windows'

    return shortcuts.map(
      (group): ProcessedShortcutGroup => ({
        label: group.label,
        items: group.items.map(
          (item): ProcessedShortcutItem => ({
            action: item.action,
            shortcut: isMacOS ? item.mac_shortcut : item.win_shortcut,
            platform,
          })
        ),
      })
    )
  }, [shortcuts, isMacOS])

  return processedShortcuts
}

/**
 * Hook to get the current platform
 * @returns Current platform identifier
 */
export function usePlatform(): Platform {
  const { isMacOS } = useDevices()
  return isMacOS ? 'mac' : 'windows'
}

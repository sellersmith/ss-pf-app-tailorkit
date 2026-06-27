import { Fragment } from 'react'
import { Text, Card, DataTable, BlockStack, InlineStack } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import { useKeyboardShortcuts, usePlatform } from '~/utils/hooks/useKeyboardShortcuts'
import type { KeyboardShortcutGroup } from '~/types/keyboardShortcuts'

interface KeyboardShortcutsTableProps {
  /** Translation function */
  t: TFunction
  /** Array of keyboard shortcut groups */
  data: KeyboardShortcutGroup[]
  /** Whether to show platform labels (default: true) */
  showPlatformLabels?: boolean
}

/**
 * Reusable keyboard shortcuts table component that displays platform-appropriate shortcuts
 */
export function KeyboardShortcutsTable({ t, data, showPlatformLabels = true }: KeyboardShortcutsTableProps) {
  const processedShortcuts = useKeyboardShortcuts(data)
  const platform = usePlatform()

  const getPlatformLabel = () => {
    switch (platform) {
      case 'mac':
        return 'Mac'
      case 'windows':
        return 'Win'
      case 'linux':
        return 'Linux'
      default:
        return 'Win'
    }
  }

  return (
    <BlockStack gap="400">
      {processedShortcuts.map(({ label, items }) => (
        <Fragment key={label}>
          <Text as="h3" variant="bodyMd" fontWeight="bold">
            {label}
          </Text>
          <Card padding="0">
            <DataTable
              hasZebraStripingOnData
              columnContentTypes={['text', 'text']}
              headings={[
                <Text as="span" key="action">
                  {t('action')}
                </Text>,
                <Text as="span" key="shortcuts" alignment="end">
                  {t('keyboard-shortcut')}
                </Text>,
              ]}
              rows={items.map(({ action, shortcut }, index: number) => [
                <Text as="span" key={`action-${index}`}>
                  {action}
                </Text>,
                <InlineStack key={`shortcuts-${index}`} gap="100" align="end">
                  <InlineStack gap="100" align="end">
                    {shortcut}
                  </InlineStack>
                  {showPlatformLabels && (
                    <Text as="span" alignment="end" tone="subdued">
                      ({getPlatformLabel()})
                    </Text>
                  )}
                </InlineStack>,
              ])}
            />
          </Card>
        </Fragment>
      ))}
    </BlockStack>
  )
}

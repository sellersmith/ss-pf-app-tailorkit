import { useState } from 'react'
import { BlockStack, Text, InlineStack, ProgressBar, Divider } from '@shopify/polaris'
import type { ISetupGuideProps } from './types'
import { SetupGuideItem } from './components/SetUpGuideItem'

export const SetupGuide = ({ items, showProgressBar, progressContent, onStepComplete }: ISetupGuideProps) => {
  const [expandedItem, setExpandedItem] = useState(items.find(item => !item.complete))
  const completedItemsLength = items.filter(item => item.complete).length
  const progressContentMsg = progressContent || `${completedItemsLength} of ${items.length} tasks completed`

  return (
    <BlockStack gap={'200'}>
      <InlineStack blockAlign="center" gap="200">
        <Text as="span" variant="bodySm">
          {progressContentMsg}
        </Text>
        {showProgressBar && completedItemsLength !== items.length ? (
          <div style={{ width: '100px' }}>
            <ProgressBar
              progress={(items.filter(item => item.complete).length / items.length) * 100}
              size="small"
              tone="primary"
              animated
            />
          </div>
        ) : null}
      </InlineStack>

      <Divider />

      <BlockStack gap={'100'}>
        {items.map(item => {
          return (
            <SetupGuideItem
              item={item}
              key={item.id}
              expanded={expandedItem?.id === item.id}
              setExpanded={() => setExpandedItem(item)}
              onComplete={onStepComplete}
            />
          )
        })}
      </BlockStack>
    </BlockStack>
  )
}

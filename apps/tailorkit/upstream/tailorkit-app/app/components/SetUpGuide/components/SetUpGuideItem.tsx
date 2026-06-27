import { useCallback, useState } from 'react'
import { ButtonGroup, Box, InlineStack, Button, Collapsible, Text, BlockStack } from '@shopify/polaris'
import styles from '../styles.module.css'
import type { ISetupGuideItemProps } from '../types'
import { MarkAsDoneButton } from './MarkAsDoneButton'

export const SetupGuideItem = (props: ISetupGuideItemProps) => {
  const { item, expanded, primaryButton, secondaryButton, tooltipContent, allowMarkAsDone, onComplete, setExpanded }
    = props
  const { id, title, description, complete } = item
  const [loading, setLoading] = useState(false)

  const completeItem = useCallback(async () => {
    setLoading(true)
    typeof onComplete === 'function' && (await onComplete(id))
    setLoading(false)
  }, [id, onComplete])

  const toggleExpanded = useCallback(() => {
    if (!expanded) {
      setExpanded()
    }
  }, [expanded, setExpanded])

  return (
    <Box borderRadius="200" background={expanded ? 'bg-surface-active' : undefined}>
      <div className={`${styles.setupItem} ${expanded ? styles.setupItemExpanded : ''}`}>
        <InlineStack gap="200" align="start" blockAlign="start" wrap={false}>
          <MarkAsDoneButton
            complete={complete}
            loading={loading}
            tooltipContent={tooltipContent}
            allowMarkAsDone={allowMarkAsDone}
            completeItem={completeItem}
          />
          <div
            onClick={toggleExpanded}
            style={{
              cursor: expanded ? 'default' : 'pointer',
              width: '100%',
            }}
          >
            <BlockStack gap="200" id={id}>
              <div className={`${styles.setupItemTitle} ${expanded ? styles.setupItemTitleExpanded : ''}`}>
                {typeof title === 'string' ? (
                  <Text as="h4" variant={expanded ? 'headingSm' : 'bodyMd'}>
                    {title}
                  </Text>
                ) : (
                  title
                )}
              </div>
              <Collapsible
                open={expanded}
                id={id}
                transition={{ duration: '100ms', timingFunction: 'ease-in-out' }}
                expandOnPrint
              >
                <Box paddingBlockEnd="150" paddingInlineEnd="150">
                  <BlockStack gap="400">
                    {typeof description === 'string' ? (
                      <Text as="p" variant="bodyMd">
                        {description}
                      </Text>
                    ) : (
                      description
                    )}
                    {primaryButton || secondaryButton ? (
                      <ButtonGroup gap="loose">
                        {primaryButton ? (
                          <Button variant="primary" {...primaryButton.props}>
                            {primaryButton.content}
                          </Button>
                        ) : null}
                        {secondaryButton ? (
                          <Button variant="tertiary" {...secondaryButton.props}>
                            {secondaryButton.content}
                          </Button>
                        ) : null}
                      </ButtonGroup>
                    ) : null}
                  </BlockStack>
                </Box>
              </Collapsible>
            </BlockStack>
          </div>
        </InlineStack>
      </div>
    </Box>
  )
}

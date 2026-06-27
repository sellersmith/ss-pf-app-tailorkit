import { type ReactNode, useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from '@shopify/polaris-icons'
import { Box, Collapsible, Icon, InlineStack, Text } from '@shopify/polaris'

interface ICollapsibleSection {
  id: string
  title: string | ReactNode
  children: React.ReactNode
  open?: boolean
}

export const CollapsibleSection = (props: ICollapsibleSection) => {
  const { id, title, children, open } = props
  const [collapsibleOpening, setCollapsibleOpening] = useState(open || false)

  const handleClickOnCollapsible = () => {
    setCollapsibleOpening(!collapsibleOpening)
  }

  return (
    <Box>
      <div onClick={handleClickOnCollapsible} style={{ cursor: 'pointer' }}>
        {typeof title === 'string' ? (
          <Box padding={'300'}>
            <InlineStack gap={'200'}>
              <span>
                <Icon source={!collapsibleOpening ? ChevronUpIcon : ChevronDownIcon} />
              </span>
              {title && (
                <Text as="span" variant="bodyMd">
                  {title}
                </Text>
              )}
            </InlineStack>
          </Box>
        ) : (
          title
        )}
      </div>
      <Collapsible open={collapsibleOpening} id={id} transition={{ duration: '300ms', timingFunction: 'ease-in-out' }}>
        {children}
      </Collapsible>
    </Box>
  )
}

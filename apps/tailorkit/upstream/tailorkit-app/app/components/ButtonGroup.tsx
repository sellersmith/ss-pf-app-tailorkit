import { BlockStack, Box, Button, InlineStack } from '@shopify/polaris'

type ButtonItem = {
  label: string
  value: string
  id?: string
}

export type ButtonGroupProps = {
  gap?: string
  label?: string
  value?: string
  onChange: (value: string) => void
  items: ButtonItem[]
}

export default function ButtonGroup(props: any) {
  const { gap = '0', label, value = '', items, onChange } = props

  return (
    <BlockStack gap={gap}>
      {label && (
        <div className="Polaris-Labelled__LabelWrapper">
          <div className="Polaris-Label">
            <label className="Polaris-Label__Text">
              <span className="Polaris-Text--root Polaris-Text--bodyMd">{label}</span>
            </label>
          </div>
        </div>
      )}
      <Box padding="100" borderRadius="200" background="bg-fill-secondary">
        <InlineStack gap="100" wrap={false} align="space-around">
          {items.map((item: ButtonItem, index: number) => (
            <Button
              fullWidth
              id={item.id}
              key={index}
              onClick={() => onChange(item.value)}
              variant={value === item.value ? 'secondary' : 'tertiary'}
            >
              {item.label}
            </Button>
          ))}
        </InlineStack>
      </Box>
    </BlockStack>
  )
}

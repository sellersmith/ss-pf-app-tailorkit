import { useState } from 'react'
import { Button, Popover, ActionList, Box } from '@shopify/polaris'
import type { TFunction } from 'i18next'

interface DynamicFieldToken {
  value: string
  label: string
  helpText?: string
}

interface DynamicFieldExtensionProps {
  label: string
  tokens: DynamicFieldToken[]
  api: {
    insertText: (value: string) => void
    getSelectionText: () => string
    close: () => void
  }
}

function DynamicFieldExtension({ label, tokens, api }: DynamicFieldExtensionProps) {
  const [open, setOpen] = useState(false)

  const handleSelect = (value: string) => {
    api.insertText(value)
    setOpen(false)
  }

  return (
    <Box paddingInline={'300'} minHeight="24px" width="100%">
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <Popover
          active={open}
          activator={
            <Button
              size="slim"
              onClick={() => setOpen(prev => !prev)}
              variant="monochromePlain"
              accessibilityLabel={label}
              disclosure={open ? 'up' : 'down'}
            >
              {label}
            </Button>
          }
          onClose={() => setOpen(false)}
        >
          <ActionList
            actionRole="menuitem"
            items={tokens.map(token => ({
              content: token.label,
              helpText: token.helpText,
              onAction: () => handleSelect(token.value),
            }))}
          />
        </Popover>
      </div>
    </Box>
  )
}

export const buildDynamicToolbarConfig = (t: TFunction, toolbarId?: string) => ({
  showDivider: false,
  formats: ['bold', 'italic', 'underline', 'color', 'background', 'link'],
  toolbarId,
  extensions: [
    {
      type: 'dynamicField',
      render: (api: { insertText: (value: string) => void; getSelectionText: () => string; close: () => void }) => (
        <DynamicFieldExtension
          label={t('dynamic-field')}
          tokens={[
            {
              value: '{{price}}',
              label: '{{price}}',
              helpText: t('the-price-of-the-add-on-product'),
            },
            {
              value: '{{compare_at_price}}',
              label: '{{compare-at-price}}',
              helpText: t('the-compare-at-price-of-the-add-on-product'),
            },
            {
              value: '{{variant_name}}',
              label: '{{variant-title}}',
              helpText: t('the-selected-variant-of-the-add-on-product'),
            },
            {
              value: '{{product_title}}',
              label: '{{product-title}}',
              helpText: t('the-name-of-the-add-on-product'),
            },
          ]}
          api={api}
        />
      ),
    },
  ],
})

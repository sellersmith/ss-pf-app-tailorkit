import { Box, InlineGrid, TextField } from '@shopify/polaris'
import { Fragment } from 'react/jsx-runtime'

type BoxModelProperties = {
  [key: string]: {
    styleKeys: string[]
    className?: string
  }
}

export const BOX_MODEL_PROPERTIES: BoxModelProperties = {
  margin: {
    styleKeys: ['marginTop', 'marginLeft', 'margin', 'marginRight', 'marginBottom'],
    className: 'mg',
  },
  padding: {
    styleKeys: ['paddingTop', 'paddingLeft', 'padding', 'paddingRight', 'paddingBottom'],
    className: 'pd',
  },
  borderRadius: {
    styleKeys: [
      'borderTopLeftRadius',
      'borderTopRightRadius',
      'borderRadius',
      'borderBottomLeftRadius',
      'borderBottomRightRadius',
    ],
    className: 'bdrd',
  },
  borderWidth: {
    styleKeys: ['borderTopWidth', 'borderLeftWidth', 'borderWidth', 'borderRightWidth', 'borderBottomWidth'],
    className: 'bdw',
  },
  borderColor: {
    styleKeys: ['borderTopColor', 'borderLeftColor', 'borderColor', 'borderRightColor', 'borderBottomColor'],
  },
}

interface BoxStyleProps {
  type: 'padding' | 'margin' | 'borderRadius'
  styleKeys: string[]
  num: Record<string, number>
  onChangeValue: (e: any) => void
  unit: Record<string, string>
  handleDisable: (key: string) => boolean
}

export default function BoxStyle(props: BoxStyleProps) {
  const { type, styleKeys, num, onChangeValue, unit, handleDisable } = props
  return (
    <Box
      background={`${type === 'padding' ? 'bg-surface-secondary' : 'bg-surface'}`}
      borderWidth="025"
      borderColor={`${type === 'padding' ? 'border-secondary' : 'transparent'}`}
      position="relative"
      borderRadius="200"
      padding={`${type === 'padding' ? '200' : '0'}`}
    >
      {type !== 'padding' && (
        <Box
          position="absolute"
          background="bg-fill-secondary"
          borderRadius="300"
          borderWidth="025"
          borderColor="border-tertiary"
          insetBlockStart="400"
          insetBlockEnd="400"
          insetInlineStart="1000"
          insetInlineEnd="1000"
        ></Box>
      )}
      <InlineGrid columns={'3'} gap="100">
        {styleKeys.map((key, idx) => {
          const placeholderNumber = 0
          // if placeholderNumber has type of number, we will display placeholderNumber otherwise we display '--
          const placeholder
            = typeof placeholderNumber === 'number' && !isNaN(placeholderNumber) ? `${placeholderNumber}` : '--'

          return (
            <Fragment key={`${key}-${idx}`}>
              {type !== 'borderRadius' && (idx < 2 || idx > 3) && <Box></Box>}
              <TextField
                label={key}
                autoComplete="off"
                name={key}
                value={num[key].toString()}
                onChange={onChangeValue}
                suffix={unit[key]}
                placeholder={placeholder}
                disabled={handleDisable(key)}
              />
              {type === 'borderRadius' && idx < 4 && <Box></Box>}
            </Fragment>
          )
        })}
      </InlineGrid>
    </Box>
  )
}

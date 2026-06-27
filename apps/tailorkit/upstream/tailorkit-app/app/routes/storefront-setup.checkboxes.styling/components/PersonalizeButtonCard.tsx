import {
  Card,
  BlockStack,
  Text,
  InlineStack,
  Box,
  RangeSlider,
  TextField,
  Divider,
  Collapsible,
  Icon,
} from '@shopify/polaris'
import { ChevronDownIcon, ChevronUpIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, useState } from 'react'
import EditorColorPicker from '~/components/common/ColorPicker'
import type { CheckboxGlobalStyling, PersonalizeButtonStyling } from '~/types/global-styling'
import { defaultPersonalizeButtonStyling } from '~/types/global-styling'

interface PersonalizeButtonCardProps {
  styling: CheckboxGlobalStyling
  onChange: (updates: Partial<CheckboxGlobalStyling>) => void
}

export default function PersonalizeButtonCard({ styling, onChange }: PersonalizeButtonCardProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [isHover, setIsHover] = useState(false)

  const pb = useMemo(
    () => ({ ...defaultPersonalizeButtonStyling, ...styling.personalizeButton }),
    [styling.personalizeButton]
  )

  const handleFieldChange = useCallback(
    (field: keyof PersonalizeButtonStyling) => (value: string | number) => {
      onChange({
        personalizeButton: {
          ...pb,
          [field]: value,
        },
      })
    },
    [onChange, pb]
  )

  /** Clear/unset handler for "done" color fields — sets to transparent. */
  const handleClearDoneColor = useCallback(
    (field: keyof PersonalizeButtonStyling) => () => {
      onChange({ personalizeButton: { ...pb, [field]: 'rgba(0, 0, 0, 0)' } })
    },
    [onChange, pb]
  )

  return (
    <Card roundedAbove="sm" padding="0">
      {/* Collapsible header */}
      <div
        className="Polaris-Box"
        onClick={() => setOpen(prev => !prev)}
        onMouseEnter={() => setIsHover(true)}
        onMouseLeave={() => setIsHover(false)}
        style={{
          cursor: 'pointer',
          padding: 'var(--p-space-400)',
          width: '100%',
          background: isHover && !open ? 'var(--p-color-bg-fill-secondary)' : 'none',
        }}
      >
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="050">
            <Text variant="headingSm" as="span">
              {t('personalize-button')}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {t('shown-on-add-on-checkboxes-that-have-a-tailorkit-design')}
            </Text>
          </BlockStack>
          <Box>
            <Icon source={open ? ChevronUpIcon : ChevronDownIcon} />
          </Box>
        </InlineStack>
      </div>

      <Collapsible id="personalize-button-content" open={open}>
        {/* Button text — side by side */}
        <Divider />
        <Box padding="400">
          <BlockStack gap="300">
            <InlineStack gap="400" wrap>
              <Box minWidth="200px" width="calc(50% - 8px)">
                <TextField
                  label={t('default-text')}
                  value={pb.buttonText}
                  onChange={value => handleFieldChange('buttonText')(value)}
                  autoComplete="off"
                  placeholder="Personalize"
                />
              </Box>
              <Box minWidth="200px" width="calc(50% - 8px)">
                <TextField
                  label={t('after-personalization')}
                  value={pb.doneText}
                  onChange={value => handleFieldChange('doneText')(value)}
                  autoComplete="off"
                  placeholder="Personalized"
                />
              </Box>
            </InlineStack>
          </BlockStack>
        </Box>

        <Divider />

        {/* Button color — background, text, border */}
        <Box padding="400">
          <BlockStack gap="300">
            <Text variant="headingSm" as="span">
              {t('button-color')}
            </Text>

            <BlockStack gap="200">
              <Text as="span" variant="bodyMd" fontWeight="medium">
                {t('background-color')}
              </Text>
              <InlineStack gap="400" wrap>
                <Box minWidth="200px" width="calc(50% - 8px)">
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">
                      {t('default')}
                    </Text>
                    <EditorColorPicker
                      value={pb.backgroundColor}
                      onChange={handleFieldChange('backgroundColor')}
                      debounceMs={100}
                    />
                  </BlockStack>
                </Box>
                <Box minWidth="200px" width="calc(50% - 8px)">
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">
                      {t('after-personalization')}
                    </Text>
                    <EditorColorPicker
                      value={pb.doneBackgroundColor || defaultPersonalizeButtonStyling.doneBackgroundColor}
                      onChange={handleFieldChange('doneBackgroundColor')}
                      onClear={handleClearDoneColor('doneBackgroundColor')}
                      debounceMs={100}
                    />
                  </BlockStack>
                </Box>
              </InlineStack>
            </BlockStack>

            {/* Text color — side by side */}
            <BlockStack gap="200">
              <Text as="span" variant="bodyMd" fontWeight="medium">
                {t('text-color')}
              </Text>
              <InlineStack gap="400" wrap>
                <Box minWidth="200px" width="calc(50% - 8px)">
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">
                      {t('default')}
                    </Text>
                    <EditorColorPicker
                      value={pb.textColor}
                      onChange={handleFieldChange('textColor')}
                      debounceMs={100}
                    />
                  </BlockStack>
                </Box>
                <Box minWidth="200px" width="calc(50% - 8px)">
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">
                      {t('after-personalization')}
                    </Text>
                    <EditorColorPicker
                      value={pb.doneTextColor || defaultPersonalizeButtonStyling.doneTextColor}
                      onChange={handleFieldChange('doneTextColor')}
                      onClear={handleClearDoneColor('doneTextColor')}
                      debounceMs={100}
                    />
                  </BlockStack>
                </Box>
              </InlineStack>
            </BlockStack>

            {/* Border color — side by side */}
            <BlockStack gap="200">
              <Text as="span" variant="bodyMd" fontWeight="medium">
                {t('border-color')}
              </Text>
              <InlineStack gap="400" wrap>
                <Box minWidth="200px" width="calc(50% - 8px)">
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">
                      {t('default')}
                    </Text>
                    <EditorColorPicker
                      value={pb.borderColor}
                      onChange={handleFieldChange('borderColor')}
                      debounceMs={100}
                    />
                  </BlockStack>
                </Box>
                <Box minWidth="200px" width="calc(50% - 8px)">
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">
                      {t('after-personalization')}
                    </Text>
                    <EditorColorPicker
                      value={pb.doneBorderColor || defaultPersonalizeButtonStyling.doneBorderColor}
                      onChange={handleFieldChange('doneBorderColor')}
                      onClear={handleClearDoneColor('doneBorderColor')}
                      debounceMs={100}
                    />
                  </BlockStack>
                </Box>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        </Box>

        <Divider />

        {/* Border radius — side by side */}
        <Box padding="400">
          <BlockStack gap="300">
            <Text as="span" variant="bodyMd" fontWeight="medium">
              {t('border-radius')}
            </Text>
            <InlineStack gap="400" wrap>
              <Box minWidth="200px" width="calc(50% - 8px)">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t('default')}
                  </Text>
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    <Box width="100%">
                      <RangeSlider
                        label={t('border-radius')}
                        labelHidden
                        value={pb.borderRadius}
                        min={0}
                        step={1}
                        onChange={value => handleFieldChange('borderRadius')(value as number)}
                        output
                      />
                    </Box>
                    <Box minWidth="70px">
                      <TextField
                        label={t('border-radius')}
                        labelHidden
                        type="number"
                        value={String(pb.borderRadius)}
                        min={0}
                        suffix="px"
                        autoComplete="off"
                        onChange={value => {
                          const num = parseInt(value, 10)
                          if (!isNaN(num) && num >= 0) handleFieldChange('borderRadius')(num)
                        }}
                      />
                    </Box>
                  </InlineStack>
                </BlockStack>
              </Box>
              <Box minWidth="200px" width="calc(50% - 8px)">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t('after-personalization')}
                  </Text>
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    <Box width="100%">
                      <RangeSlider
                        label={t('border-radius')}
                        labelHidden
                        value={pb.doneBorderRadius}
                        min={0}
                        step={1}
                        onChange={value => handleFieldChange('doneBorderRadius')(value as number)}
                        output
                      />
                    </Box>
                    <Box minWidth="70px">
                      <TextField
                        label={t('border-radius')}
                        labelHidden
                        type="number"
                        value={String(pb.doneBorderRadius)}
                        min={0}
                        suffix="px"
                        autoComplete="off"
                        onChange={value => {
                          const num = parseInt(value, 10)
                          if (!isNaN(num) && num >= 0) handleFieldChange('doneBorderRadius')(num)
                        }}
                      />
                    </Box>
                  </InlineStack>
                </BlockStack>
              </Box>
            </InlineStack>
          </BlockStack>
        </Box>

        <Divider />

        {/* Padding — vertical and horizontal */}
        <Box padding="400">
          <BlockStack gap="300">
            <Text as="span" variant="bodyMd" fontWeight="medium">
              {t('vertical-padding')}
            </Text>
            <InlineStack gap="400" wrap>
              <Box minWidth="200px" width="calc(50% - 8px)">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t('default')}
                  </Text>
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    <Box width="100%">
                      <RangeSlider
                        label={t('vertical-padding')}
                        labelHidden
                        value={pb.paddingBlock}
                        min={0}
                        step={1}
                        onChange={value => handleFieldChange('paddingBlock')(value as number)}
                        output
                      />
                    </Box>
                    <Box minWidth="70px">
                      <TextField
                        label={t('vertical-padding')}
                        labelHidden
                        type="number"
                        value={String(pb.paddingBlock)}
                        min={0}
                        suffix="px"
                        autoComplete="off"
                        onChange={value => {
                          const num = parseInt(value, 10)
                          if (!isNaN(num) && num >= 0) handleFieldChange('paddingBlock')(num)
                        }}
                      />
                    </Box>
                  </InlineStack>
                </BlockStack>
              </Box>
              <Box minWidth="200px" width="calc(50% - 8px)">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t('after-personalization')}
                  </Text>
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    <Box width="100%">
                      <RangeSlider
                        label={t('vertical-padding')}
                        labelHidden
                        value={pb.donePaddingBlock}
                        min={0}
                        step={1}
                        onChange={value => handleFieldChange('donePaddingBlock')(value as number)}
                        output
                      />
                    </Box>
                    <Box minWidth="70px">
                      <TextField
                        label={t('vertical-padding')}
                        labelHidden
                        type="number"
                        value={String(pb.donePaddingBlock)}
                        min={0}
                        suffix="px"
                        autoComplete="off"
                        onChange={value => {
                          const num = parseInt(value, 10)
                          if (!isNaN(num) && num >= 0) handleFieldChange('donePaddingBlock')(num)
                        }}
                      />
                    </Box>
                  </InlineStack>
                </BlockStack>
              </Box>
            </InlineStack>

            {/* Padding — horizontal */}
            <Text as="span" variant="bodyMd" fontWeight="medium">
              {t('horizontal-padding')}
            </Text>
            <InlineStack gap="400" wrap>
              <Box minWidth="200px" width="calc(50% - 8px)">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t('default')}
                  </Text>
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    <Box width="100%">
                      <RangeSlider
                        label={t('horizontal-padding')}
                        labelHidden
                        value={pb.paddingInline}
                        min={0}
                        step={1}
                        onChange={value => handleFieldChange('paddingInline')(value as number)}
                        output
                      />
                    </Box>
                    <Box minWidth="70px">
                      <TextField
                        label={t('horizontal-padding')}
                        labelHidden
                        type="number"
                        value={String(pb.paddingInline)}
                        min={0}
                        suffix="px"
                        autoComplete="off"
                        onChange={value => {
                          const num = parseInt(value, 10)
                          if (!isNaN(num) && num >= 0) handleFieldChange('paddingInline')(num)
                        }}
                      />
                    </Box>
                  </InlineStack>
                </BlockStack>
              </Box>
              <Box minWidth="200px" width="calc(50% - 8px)">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t('after-personalization')}
                  </Text>
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    <Box width="100%">
                      <RangeSlider
                        label={t('horizontal-padding')}
                        labelHidden
                        value={pb.donePaddingInline}
                        min={0}
                        step={1}
                        onChange={value => handleFieldChange('donePaddingInline')(value as number)}
                        output
                      />
                    </Box>
                    <Box minWidth="70px">
                      <TextField
                        label={t('horizontal-padding')}
                        labelHidden
                        type="number"
                        value={String(pb.donePaddingInline)}
                        min={0}
                        suffix="px"
                        autoComplete="off"
                        onChange={value => {
                          const num = parseInt(value, 10)
                          if (!isNaN(num) && num >= 0) handleFieldChange('donePaddingInline')(num)
                        }}
                      />
                    </Box>
                  </InlineStack>
                </BlockStack>
              </Box>
            </InlineStack>
          </BlockStack>
        </Box>
      </Collapsible>
    </Card>
  )
}

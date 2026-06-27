import type { FunctionComponent, ReactNode, SVGProps } from 'react'
import type { TFunction } from 'i18next'
import { escapeRegExp } from '~/utils/escapeRegex'
import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  InlineStack,
  Tag,
  Listbox,
  EmptySearchResult,
  Combobox,
  Text,
  AutoSelection,
  Thumbnail,
} from '@shopify/polaris'
import { getShopifyThumbnail } from '~/utils/loadImage'

export type MultiselectComboboxProps = {
  t: TFunction
  selected?: string[]
  id?: number | string
  containerStyle?: any
  placeholder?: string
  maxTagWidth?: string
  labelHidden?: boolean
  maxLabelWidth?: string
  label?: string | ReactNode
  items: { label: string; value: string; disabled?: boolean }[]
  onChange: (tags: string[], id?: number | string) => void
  getImageSource?: (item: { label: string; value: string }) => string | FunctionComponent<SVGProps<SVGSVGElement>>
}

export default function MultiselectCombobox(props: MultiselectComboboxProps) {
  const {
    t,
    id,
    items,
    label,
    onChange,
    placeholder,
    maxTagWidth,
    maxLabelWidth,
    selected = [],
    containerStyle,
    getImageSource,
    labelHidden = false,
  } = props

  const [value, setValue] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>(selected)

  useEffect(() => {
    if (typeof onChange === 'function') {
      onChange(selectedTags, id)
    }
  }, [id, onChange, selectedTags])

  const handleActiveOptionChange = useCallback(
    (activeOption: string) => {
      const activeOptionIsAction = activeOption === value

      if (!activeOptionIsAction && !selectedTags.includes(activeOption)) {
        setSuggestion(activeOption)
      } else {
        setSuggestion('')
      }
    },
    [value, selectedTags]
  )

  const updateSelection = useCallback(
    (selected: string) => {
      const nextSelectedTags = new Set([...selectedTags])

      if (nextSelectedTags.has(selected)) {
        nextSelectedTags.delete(selected)
      } else {
        nextSelectedTags.add(selected)
      }

      setSelectedTags([...nextSelectedTags])
      setSuggestion('')
      setValue('')
    },
    [selectedTags]
  )

  const removeTag = useCallback((tag: string) => () => updateSelection(tag), [updateSelection])

  const formatOptionText = useCallback(
    (option: { label: string; value: string; disabled?: boolean }) => {
      let html: any = ''
      const { label } = option
      const trimValue = value.trim().toLocaleLowerCase()
      const matchIndex = label.toLocaleLowerCase().indexOf(trimValue)

      if (!value || matchIndex === -1) {
        html = label
      } else {
        const start = label.slice(0, matchIndex)
        const highlight = label.slice(matchIndex, matchIndex + trimValue.length)
        const end = label.slice(matchIndex + trimValue.length, label.length)

        html = (
          <>
            {start}
            <Text fontWeight="bold" as="span">
              {highlight}
            </Text>
            {end}
          </>
        )
      }

      const imageSource = typeof getImageSource === 'function' ? getImageSource(option) : null

      return (
        <InlineStack gap="100">
          {imageSource && <Thumbnail source={getShopifyThumbnail(imageSource)} alt={''} size="extraSmall" />}
          <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: maxLabelWidth }}>
            {html}
          </div>
        </InlineStack>
      )
    },
    [getImageSource, maxLabelWidth, value]
  )

  const options = useMemo(() => {
    let list

    const filterRegex = new RegExp(escapeRegExp(value), 'i')

    if (value) {
      list = items.filter(tag => tag.label.match(filterRegex))
    } else {
      list = items
    }

    return [...list]
  }, [value, items])

  const verticalContentMarkup
    = selectedTags.length > 0 ? (
      <InlineStack gap="100">
        {selectedTags.map(tag => {
          const item = items.find(item => item.value === tag)

          return (
            <Tag key={`option-${tag}`} onRemove={removeTag(tag)}>
              <div
                style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: maxTagWidth }}
              >
                {item?.label}
              </div>
            </Tag>
          )
        })}
      </InlineStack>
    ) : null

  const optionMarkup
    = options.length > 0
      ? options.map(option => {
          return (
            <Listbox.Option
              key={option.value}
              value={option.value}
              accessibilityLabel={option.label}
              selected={selectedTags.includes(option.value)}
              disabled={option.disabled}
            >
              <Listbox.TextOption selected={selectedTags.includes(option.value)} disabled={option.disabled}>
                {formatOptionText(option)}
              </Listbox.TextOption>
            </Listbox.Option>
          )
        })
      : null

  const emptyStateMarkup = optionMarkup ? null : (
    <EmptySearchResult title="" description={t('nothing-matches-value', { value })} />
  )

  const listboxMarkup = optionMarkup ? (
    <Listbox
      onSelect={updateSelection}
      autoSelection={AutoSelection.None}
      onActiveOptionChange={handleActiveOptionChange}
    >
      {optionMarkup}
    </Listbox>
  ) : (
    emptyStateMarkup
  )

  return (
    <div style={containerStyle}>
      <Combobox
        allowMultiple
        activator={
          <Combobox.TextField
            value={value}
            autoComplete="off"
            onChange={setValue}
            suggestion={suggestion}
            labelHidden={labelHidden}
            label={label || t('search-tags')}
            verticalContent={verticalContentMarkup}
            placeholder={placeholder || t('search-tags')}
          />
        }
      >
        {listboxMarkup}
      </Combobox>
    </div>
  )
}

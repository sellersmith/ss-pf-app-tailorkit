import { Box, Icon, InlineGrid, Text } from '@shopify/polaris'
import { AlertCircleIcon } from '@shopify/polaris-icons'
import { useMemo, useRef } from 'react'
import Quill from 'react-quill-new'
import EditorToolbar, { EDITOR_TOOLBAR_FORMATS, EDITOR_TOOLBAR_MODULES } from './EditorToolBar'

interface RichTextEditorProps {
  bounds?: string
  defaultValue?: string
  formats?: string[]
  id?: string
  modules?: any
  placeholder?: string
  preserveWhitespace?: boolean
  value?: string
  label?: string
  labelHidden?: boolean
  disabled?: boolean
  error?: string
  onBlur?: (event: any) => void
  onChange: (event: any) => void
  onChangeSelection?: (event: any) => void
  onFocus?: (event: any) => void
  onKeyDown?: (event: any) => void
  onKeyPress?: (event: any) => void
  onKeyUp?: (event: any) => void
  toolbarConfig?: {
    showDivider?: boolean
    formats?: string[]
    modules?: any
    toolbarId?: string
    extensions?: Array<{
      type: string
      render: (api: {
        insertText: (value: string) => void
        getSelectionText: () => string
        close: () => void
      }) => React.ReactNode
    }>
  }
  plainTextPaste?: boolean
}

export function RichTextEditor(props: RichTextEditorProps) {
  const {
    defaultValue,
    formats,
    id,
    modules,
    onBlur,
    onChange,
    onChangeSelection,
    onFocus,
    onKeyDown,
    onKeyPress,
    onKeyUp,
    placeholder,
    preserveWhitespace,
    value,
    label,
    labelHidden = false,
    disabled,
    error,
    toolbarConfig,
    plainTextPaste = false,
  } = props

  const quillRef = useRef<Quill>(null)

  const toolbarId = toolbarConfig?.toolbarId || 'toolbar'
  const resolvedFormats = toolbarConfig?.formats || formats || EDITOR_TOOLBAR_FORMATS

  const normalizedFormats = useMemo(() => {
    const set = new Set(resolvedFormats || [])

    if (set.has('link')) {
      set.add('target')
    }

    return Array.from(set)
  }, [resolvedFormats])

  const mergedModules = useMemo(() => {
    const baseModules = {
      ...EDITOR_TOOLBAR_MODULES,
      toolbar: {
        ...EDITOR_TOOLBAR_MODULES.toolbar,
        container: `#${toolbarId}`,
      },
    }

    const customModules = toolbarConfig?.modules || modules
    if (!customModules) return baseModules

    return {
      ...baseModules,
      ...customModules,
      toolbar: {
        ...baseModules.toolbar,
        ...(customModules.toolbar || {}),
        container: (customModules.toolbar && customModules.toolbar.container) || `#${toolbarId}`,
      },
    }
  }, [toolbarConfig?.modules, modules, toolbarId])

  let className = disabled ? 'quill--disabled' : ''
  if (error) className += 'quill--error'

  return (
    <Box>
      {!labelHidden && (
        <Box paddingBlockEnd="100">
          <Text as="p" tone={disabled ? 'disabled' : 'base'}>
            {label}
          </Text>
        </Box>
      )}

      <div className={'quill'}>
        <EditorToolbar
          quillRef={quillRef}
          onChange={onChange}
          formats={normalizedFormats}
          toolbarId={toolbarId}
          plainTextPaste={plainTextPaste}
          extensions={toolbarConfig?.extensions}
          showDivider={toolbarConfig?.showDivider}
        />
        <Quill
          ref={quillRef}
          // bounds={bounds}
          className={className}
          defaultValue={defaultValue}
          formats={normalizedFormats}
          id={id}
          // modules={mergedModuleOptions}
          modules={mergedModules}
          onBlur={onBlur}
          onChange={onChange}
          onChangeSelection={onChangeSelection}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          onKeyPress={onKeyPress}
          onKeyUp={onKeyUp}
          placeholder={placeholder}
          preserveWhitespace={preserveWhitespace}
          readOnly={disabled}
          theme="snow"
          value={value}
        />
        {error && (
          <InlineGrid alignItems="start" gap="150" columns="20px auto">
            <Icon source={AlertCircleIcon} tone="textCritical" />
            <Text as="p" tone="critical">
              {error}
            </Text>
          </InlineGrid>
        )}
      </div>
    </Box>
  )
}

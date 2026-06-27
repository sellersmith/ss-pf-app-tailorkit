import { ActionList, Bleed, Box, Button, Icon, InlineStack, Popover, Text, Tooltip } from '@shopify/polaris'
import { KeyboardIcon, MeasurementSizeIcon, MenuVerticalIcon, RedoIcon, UndoIcon } from '@shopify/polaris-icons'
import type { TFunction } from 'i18next'
import { memo, useMemo } from 'react'
import { FlexCenter } from '~/components/common/Flex'
import { PreviewProductImage } from '~/modules/TemplateEditor/components/Header/PreviewProductImage'
import { TemplateViewScale } from '~/modules/TemplateEditor/components/Header/TemplateViewScale'
import type { ToolBarQuickTool } from '~/modules/TemplateEditor/contexts/ToolBarContext'
import MockupDownloadButton from '../Canvas/MockupDownloadButton'
import { GridToolWrapper } from './components/GridToolWrapper'

/**
 * EditingToolsDesktop - Desktop tools area (Preview Image / Download, Zoom, Undo/Redo, Menu)
 */
export const EditingToolsDesktop = memo(function EditingToolsDesktop(props: {
  isDesignTab: boolean
  t: TFunction
  isMac: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  menuPopoverActive: boolean
  toggleMenuPopover: () => void
  isShowingRulerTool: boolean
  isShowingGridTool: boolean
  onQuickToolsChangeHandler: (tool: ToolBarQuickTool) => void
  toggleKeyboardModal: () => void
  openLiveChat: () => void
  isChatOpen?: boolean
  onToggleChat?: () => void
}) {
  const {
    isDesignTab,
    t,
    isMac,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    menuPopoverActive,
    toggleMenuPopover,
    isShowingRulerTool,
    isShowingGridTool,
    onQuickToolsChangeHandler,
    toggleKeyboardModal,
    isChatOpen,
    onToggleChat,
  } = props

  const menuSections: Array<{ items: Array<Record<string, unknown>> }> = useMemo(
    () => [
      {
        items: [
          ...(isDesignTab
            ? [
                {
                  content: (
                    <Bleed marginBlock={'150'} marginInline={'150'}>
                      <PreviewProductImage />
                    </Bleed>
                  ),
                },
              ]
            : []),
          {
            content: t('ruler'),
            icon: MeasurementSizeIcon,
            onAction: () => {
              onQuickToolsChangeHandler('ruler-tool' as ToolBarQuickTool)
              toggleMenuPopover()
            },
            active: isShowingRulerTool,
          },
          {
            content: (
              <Bleed marginBlock={'150'} marginInline={'150'}>
                <GridToolWrapper
                  t={t}
                  isShowingGridTool={isShowingGridTool}
                  onQuickToolsChangeHandler={onQuickToolsChangeHandler}
                />
              </Bleed>
            ),
          },
          {
            content: t('keyboard-shortcuts'),
            icon: KeyboardIcon,
            onAction: () => {
              toggleKeyboardModal()
              toggleMenuPopover()
            },
          },
        ],
      },
      // {
      //   items: [
      //     {
      //       content: t('live-chat', { defaultValue: 'Live Chat' }),
      //       icon: ChatIcon,
      //       onAction: openLiveChat,
      //     },
      //   ],
      // },
    ],
    [
      isDesignTab,
      t,
      isShowingRulerTool,
      isShowingGridTool,
      onQuickToolsChangeHandler,
      toggleKeyboardModal,
      toggleMenuPopover,
    ]
  )

  return (
    <InlineStack gap={'200'} blockAlign="center">
      {isDesignTab && (
        <>
          <TemplateViewScale />
          <Tooltip content={`${t('undo')} (${isMac ? '⌘' : 'Ctrl'} + Z)`}>
            <FlexCenter>
              <Button
                variant="monochromePlain"
                size="micro"
                icon={<Icon source={UndoIcon} tone={canUndo ? 'base' : 'subdued'} />}
                disabled={!canUndo}
                onClick={onUndo}
              />
            </FlexCenter>
          </Tooltip>
          <Tooltip content={`${t('redo')} (${isMac ? '⌘ + ⇧' : 'Ctrl + Shift'} + Z)`}>
            <FlexCenter>
              <Button
                variant="monochromePlain"
                size="micro"
                icon={<Icon source={RedoIcon} tone={canRedo ? 'base' : 'subdued'} />}
                disabled={!canRedo}
                onClick={onRedo}
              />
            </FlexCenter>
          </Tooltip>
        </>
      )}

      {!isDesignTab && <MockupDownloadButton />}

      {/* Elva AI chat toggle — styled like PageFly Flymate */}
      {onToggleChat && (
        <Tooltip content={t('elva-ai-assistant')}>
          <div
            onClick={onToggleChat}
            style={{
              width: 'max-content',
              height: '100%',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '5px 10px 5px 6px',
              gap: '6px',
              background: isChatOpen
                ? 'linear-gradient(135deg, rgba(41, 132, 90, 0.15), rgba(28, 100, 67, 0.1))'
                : 'var(--p-color-bg-surface)',
              border: isChatOpen ? '1px solid rgba(41, 132, 90, 0.3)' : '1px solid var(--p-color-border)',
              marginRight: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            {/* TailorKit logo icon */}
            <img
              src="https://cdn.shopify.com/app-store/listing_images/958e5ec4440b11eb378c3c27a7a4097d/icon/CKPAh-fW_YYDEAE=.png"
              alt="Elva"
              style={{ width: '22px', height: '22px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
            />
            <Text as="p" variant="bodyMd" fontWeight="medium">
              Elva
            </Text>
          </div>
        </Tooltip>
      )}

      <Popover
        active={menuPopoverActive}
        preventCloseOnChildOverlayClick
        activator={
          <Bleed marginBlockEnd={'100'}>
            <Button variant="monochromePlain" icon={MenuVerticalIcon} onClick={toggleMenuPopover} />
          </Bleed>
        }
        onClose={toggleMenuPopover}
        activatorWrapper="span"
      >
        <ActionList sections={menuSections} />
      </Popover>

      <Box borderColor="border" borderInlineStartWidth="050" minHeight="20px" />
    </InlineStack>
  )
})

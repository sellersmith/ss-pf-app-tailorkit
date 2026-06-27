import { ActionList, Bleed, Box, InlineStack, Text } from '@shopify/polaris'
import { ChatIcon, LiveIcon, MeasurementSizeIcon, RedoIcon, UndoIcon } from '@shopify/polaris-icons'
import type { TFunction } from 'i18next'
import { memo } from 'react'
import { PreviewProductImage } from '~/modules/TemplateEditor/components/Header/PreviewProductImage'
import { TemplateViewScale } from '~/modules/TemplateEditor/components/Header/TemplateViewScale'
import type { ToolBarQuickTool } from '~/modules/TemplateEditor/contexts/ToolBarContext'
import MockupDownloadButton from '../Canvas/MockupDownloadButton'
import { GridToolWrapper } from './components/GridToolWrapper'
import { UnLinkIconCritical } from '~/assets/icons'

/**
 * MobileMenuList - The ActionList content rendered inside mobile popover
 */
export const MobileMenuList = memo(function MobileMenuList(props: {
  t: TFunction
  isDesignTab: boolean
  isShowingRulerTool: boolean
  isShowingGridTool: boolean
  canViewLive: boolean
  shouldShowUnpublish: boolean
  handleViewLive: () => void
  handleUnpublish: () => void
  onQuickToolsChangeHandler: (tool: ToolBarQuickTool) => void
  toggleKeyboardModal: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  openLiveChat: () => void
}) {
  const {
    t,
    isDesignTab,
    isShowingRulerTool,
    isShowingGridTool,
    onQuickToolsChangeHandler,
    onUndo,
    onRedo,
    openLiveChat,
    canViewLive,
    shouldShowUnpublish,
    handleViewLive,
    handleUnpublish,
    canUndo,
    canRedo,
  } = props

  const menuItems: Array<{ items: Array<Record<string, unknown>> }> = [
    {
      items: [
        canViewLive
          ? {
              icon: LiveIcon,
              content: t('view-live'),
              onAction: () => {
                handleViewLive()
              },
            }
          : null,
        shouldShowUnpublish
          ? {
              content: (
                <InlineStack wrap={false} blockAlign="center" gap="200" align="start">
                  <Box width="20px">{UnLinkIconCritical}</Box>
                  <Text as="span" variant="bodyMd" fontWeight="medium">
                    {t('unpublish')}
                  </Text>
                </InlineStack>
              ),
              destructive: true,
              onAction: () => {
                handleUnpublish()
              },
            }
          : null,
      ].filter(Boolean) as Record<string, unknown>[],
    },
    {
      items: [
        ...(isDesignTab
          ? [
              {
                content: (
                  <Bleed marginBlock={'150'} marginInline={'150'}>
                    <TemplateViewScale />
                  </Bleed>
                ),
              },
            ]
          : []),
        {
          content: (
            <Bleed marginBlock={'150'} marginInline={'150'}>
              {isDesignTab ? <PreviewProductImage /> : <MockupDownloadButton />}
            </Bleed>
          ),
        },
        {
          content: t('ruler'),
          icon: MeasurementSizeIcon,
          onAction: () => onQuickToolsChangeHandler('ruler-tool' as ToolBarQuickTool),
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
        // {
        //   content: t('keyboard-shortcuts'),
        //   icon: KeyboardIcon,
        //   onAction: () => toggleKeyboardModal(),
        // },
      ],
    },
    ...(isDesignTab
      ? [
          {
            items: [
              {
                content: `${t('undo')}`,
                icon: UndoIcon,
                onAction: onUndo,
                disabled: !canUndo,
              },
              {
                content: `${t('redo')}`,
                icon: RedoIcon,
                onAction: onRedo,
                disabled: !canRedo,
              },
            ],
          },
        ]
      : []),
    {
      items: [
        {
          content: t('live-chat', { defaultValue: 'Live Chat' }),
          icon: ChatIcon,
          onAction: openLiveChat,
        },
      ],
    },
  ]

  return <ActionList sections={menuItems} />
})

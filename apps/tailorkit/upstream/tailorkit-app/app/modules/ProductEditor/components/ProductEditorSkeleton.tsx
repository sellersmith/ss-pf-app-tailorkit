import type { ReactNode } from 'react'
import {
  Box,
  InlineStack,
  BlockStack,
  SkeletonDisplayText,
  SkeletonBodyText,
  SkeletonTabs,
  useBreakpoints,
} from '@shopify/polaris'
import { useSearchParams } from '@remix-run/react'
import { EDITOR_TABS } from '../constants'
import useDevices from '~/utils/hooks/useDevice'
import useWindowSize from '~/utils/hooks/useWindowSize'

/**
 * ProductEditorSkeleton - Loading skeleton that matches the ProductEditor layout
 *
 * Mirrors the actual editor structure with:
 * - Header with title, tabs, and action buttons
 * - Canvas area with thumbnail skeleton
 * - Inspector panel with skeleton content
 * - Template outline sidebar (design tab only, desktop)
 * - Fully responsive across desktop, tablet, and mobile breakpoints
 */
export default function ProductEditorSkeleton({ progressOverlay }: { progressOverlay?: ReactNode }) {
  const { smUp, mdUp } = useBreakpoints()
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') || EDITOR_TABS.MOCKUP
  const previewMode = searchParams.get('previewMode') === 'true'
  const { isSmallDesktopView } = useDevices()
  const { width: viewportWidth } = useWindowSize()

  // Match DesignMockupPreviewTabs: preview tab only shown below 1056px
  const skeletonTabCount = viewportWidth < 1056 ? 3 : 2

  const isSmallMobileView = !smUp
  const isTabletView = smUp && !mdUp
  const isTabletOrMobile = Boolean(isTabletView || isSmallMobileView)
  const isDesignTab = tab === EDITOR_TABS.DESIGN

  // Template outline sidebar is only visible on:
  // - Design tab
  // - Desktop view (not tablet/mobile)
  // - NOT small desktop view (lgDown is hidden)
  const showSidebar = isDesignTab && !isTabletOrMobile && !isSmallDesktopView

  // Match inspector width from actual editor (default: 380px)
  const inspectorWidth = 380
  // Template outline sidebar width (design tab only, ~60px)
  const sidebarWidth = 60

  // Calculate grid columns based on view and tab
  const gridTemplateColumns = isTabletOrMobile
    ? '1fr'
    : showSidebar
      ? `${sidebarWidth}px minmax(0, 2fr) ${inspectorWidth}px`
      : `minmax(0, 2fr) ${inspectorWidth}px`

  // Calculate grid rows based on view (more explicit for mobile vs tablet vs desktop)
  const gridTemplateRows = isSmallMobileView
    ? 'auto 1fr auto' // Mobile: compact inspector at bottom
    : isTabletView
      ? 'auto 1fr minmax(300px, 40%)' // Tablet: larger inspector
      : 'auto 1fr' // Desktop: header + content, no explicit third row

  return (
    <div
      id="integration-editor"
      style={{
        display: 'grid',
        height: '100vh',
        width: '100vw',
        gridTemplateColumns,
        gridTemplateRows,
        backgroundColor: 'var(--p-color-bg-surface)',
        overflow: 'hidden',
      }}
    >
      {/* Header Section */}
      <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--p-color-bg-fill)' }}>
        <Box paddingBlock="200" paddingInline="400" borderBlockEndWidth="025" borderColor="border">
          {isTabletOrMobile ? (
            // Mobile/Tablet: Two-row layout
            <Box>
              {/* Row 1: Product title + Action buttons */}
              <InlineStack align="space-between" blockAlign="center" gap="400" wrap={false}>
                <Box minWidth="200px" maxWidth="300px">
                  <SkeletonDisplayText size="small" />
                </Box>
                <InlineStack gap="200">
                  <Box minWidth="80px">
                    <SkeletonDisplayText size="small" />
                  </Box>
                </InlineStack>
              </InlineStack>

              {/* Row 2: Tabs + Menu */}
              <Box paddingBlockStart="200">
                <InlineStack gap="200" blockAlign="center" align="space-between" wrap={false}>
                  <div style={{ flex: 1 }}>
                    <SkeletonTabs count={skeletonTabCount} fitted />
                  </div>
                  <Box minWidth="32px">
                    <SkeletonDisplayText size="small" />
                  </Box>
                </InlineStack>
              </Box>
            </Box>
          ) : (
            // Desktop: Single-row layout
            <InlineStack align="space-between" blockAlign="center" gap="400">
              {/* Left: Product title */}
              <Box minWidth="200px" maxWidth="300px">
                <SkeletonDisplayText size="small" />
              </Box>

              {/* Center: Tabs */}
              <div style={{ flex: 1, maxWidth: '320px' }}>
                <SkeletonTabs count={skeletonTabCount} fitted />
              </div>

              {/* Right: Tools + Action buttons */}
              <InlineStack gap="200" blockAlign="center" align="end" wrap={false}>
                <Box minWidth="150px">
                  <SkeletonDisplayText size="small" />
                </Box>
                <Box minWidth="100px">
                  <SkeletonDisplayText size="small" />
                </Box>
              </InlineStack>
            </InlineStack>
          )}
        </Box>
      </div>

      {/* Template Outline Sidebar (Design tab, Desktop only, NOT small desktop) */}
      {showSidebar && (
        <div
          style={{
            gridColumn: '1',
            gridRow: '2',
            backgroundColor: 'var(--p-color-bg-fill)',
            overflow: 'auto',
          }}
        >
          <Box padding="200">
            <BlockStack gap="200">
              {/* Tool icons skeleton */}
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  }}
                >
                  <Box minWidth="40px" minHeight="40px" background="bg-surface-secondary" borderRadius="200" />
                </div>
              ))}
            </BlockStack>
          </Box>
        </div>
      )}

      {/* Canvas Section */}
      <div
        style={{
          display: 'flex',
          height: '100%',
          overflow: 'hidden',
          gridColumn: isTabletOrMobile ? '1 / -1' : showSidebar ? '2' : '1',
          gridRow: isTabletOrMobile ? '2' : undefined,
          minHeight: 0,
          flexDirection: isTabletOrMobile ? 'column' : 'row',
        }}
      >
        <div
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            overflow: 'auto',
            overflowX: isTabletOrMobile ? 'hidden' : undefined,
          }}
        >
          <div
            style={{
              background: 'var(--p-color-bg-fill-disabled)',
              padding: 'var(--p-space-200)',
              height: '100%',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'var(--p-color-bg-surface)',
                borderRadius: 'var(--p-border-radius-200)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {/* Large canvas thumbnail skeleton */}
              <div
                style={{
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }}
              >
                <Box
                  width={isSmallMobileView ? '280px' : '400px'}
                  minHeight={isSmallMobileView ? '350px' : '500px'}
                  background="bg-surface-secondary"
                  borderRadius="200"
                />
              </div>
              {progressOverlay ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      pointerEvents: 'auto',
                    }}
                  >
                    {progressOverlay}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Inspector Section */}
      {/* Mobile non-preview mode: Inspector is in bottom sheet, don't render here */}
      {/* Mobile preview mode: Inspector is inline */}
      {/* Tablet: Inspector always inline */}
      {/* Desktop: Inspector always inline */}
      {(!isSmallMobileView || previewMode) && (
        <div
          style={{
            gridColumn: isTabletOrMobile ? '1 / -1' : showSidebar ? '3' : '2',
            gridRow: isTabletOrMobile ? '3' : undefined,
            overflow: 'auto',
            position: 'relative',
            maxHeight: isSmallMobileView ? '40vh' : undefined, // Limit mobile inspector height
          }}
        >
          <Box padding={isSmallMobileView ? '300' : '400'}>
            <BlockStack gap={isSmallMobileView ? '300' : '400'}>
              {/* Section 1 */}
              <BlockStack gap="200">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={isSmallMobileView ? 2 : 3} />
              </BlockStack>

              {/* Section 2 */}
              <BlockStack gap="200">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={2} />
              </BlockStack>

              {/* Section 3 - Only show on tablet/desktop */}
              {!isSmallMobileView && (
                <BlockStack gap="200">
                  <SkeletonDisplayText size="small" />
                  <SkeletonBodyText lines={4} />
                </BlockStack>
              )}

              {/* Section 4 - Only show on tablet/desktop */}
              {!isSmallMobileView && (
                <BlockStack gap="200">
                  <SkeletonDisplayText size="small" />
                  <SkeletonBodyText lines={2} />
                </BlockStack>
              )}

              {/* Section 5 - Only show on desktop */}
              {!isSmallMobileView && !isTabletView && (
                <BlockStack gap="200">
                  <SkeletonDisplayText size="small" />
                  <SkeletonBodyText lines={3} />
                </BlockStack>
              )}
            </BlockStack>
          </Box>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  )
}

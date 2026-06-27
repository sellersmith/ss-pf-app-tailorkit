import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Image,
  InlineStack,
  SkeletonBodyText,
  SkeletonThumbnail,
  Text,
  Tooltip,
} from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import CardWithDismiss from './CardWithDismiss'
import useDevices from '~/utils/hooks/useDevice'
import { useMemo } from 'react'
import { CarouselWithPagination } from '~/components/Carousel'
import useBlogPosts from '~/hooks/useBlogPosts'
import { OCCURRED_EVENTS } from '~/routes/api.preferences/constants'

/**
 * BlogPromotionCard component that displays personalized blog posts using RAG (Retrieval Augmented Generation)
 *
 * Shows 2 blog posts:
 * - 1 personalized post based on shop metadata (categories, description)
 * - 1 latest post (excluding the personalized one)
 *
 * This replaces the previous Google Sheets approach with a Supabase + vector similarity search
 *
 * @example: Key	Title	Image	Description	Button Text	Button Link	Badge Content	Start Date	End Date	Position
 */

function BlogPromotionCard() {
  const { t } = useTranslation()

  const { trackEvent } = useEventsTracking()
  const { isMobileView } = useDevices()

  const onClickAppHandler = (appId: string, link: string) => {
    window.open(link, '_blank')

    trackEvent(EVENTS_TRACKING.CLICK_BLOG_PROMOTION, {
      [EVENTS_PARAMETERS_NAME.BLOG_PROMOTION]: appId,
    })
  }

  const itemsPerSlide = useMemo(() => (isMobileView ? 1 : 3), [isMobileView])

  const { loading, intro, activeBlogPosts } = useBlogPosts({ position: 'Dashboard' })

  // Show up to 3 items. Server may return 2 (2 personalized) or 3 (1 personalized + 2 latest or 3 latest)
  const displayBlogPosts = useMemo(() => activeBlogPosts.slice(0, 3), [activeBlogPosts])
  const numBlogPosts = useMemo(() => displayBlogPosts.length, [displayBlogPosts])

  if (!displayBlogPosts || displayBlogPosts.length === 0) return null

  return (
    <CardWithDismiss
      title={intro.heading || t('explore-our-blog')}
      cardName={OCCURRED_EVENTS.EXPLORE_OUR_BLOG_CARD_DASHBOARD_DISMISSED}
    >
      <BlockStack gap={'300'}>
        <Text as="p" variant="bodyMd">
          {intro.description || t('discover-personalized-content')}
        </Text>

        <CarouselWithPagination
          id="personalized-blog-posts"
          numItems={numBlogPosts}
          itemsPerSlide={itemsPerSlide}
          disableScrollDetection={false}
        >
          {loading
            ? Array.from({ length: itemsPerSlide }).map((_, index) => <PromotionsSkeleton key={index} />)
            : displayBlogPosts.map((post, index) => (
                <Box
                  key={index}
                  padding="0"
                  minHeight="100%"
                  shadow="100"
                  borderColor="border"
                  borderRadius="200"
                  borderWidth="025"
                  overflowX="hidden"
                  overflowY="hidden"
                >
                  <div style={{ position: 'relative', maxHeight: '196px', overflow: 'hidden' }}>
                    <Image alt={post.title} source={post.image} style={{ width: '100%' }} />
                    {post.badgeContent && (
                      <div style={{ position: 'absolute', top: '.75rem', right: '.75rem' }}>
                        <Badge tone="success">{post.badgeContent}</Badge>
                      </div>
                    )}
                  </div>
                  <Box padding="300">
                    <BlockStack gap={'300'}>
                      <Tooltip content={post.title}>
                        <InlineStack gap={'300'} blockAlign="center">
                          <Text as="h3" variant="headingSm">
                            {post.title}
                          </Text>
                        </InlineStack>
                      </Tooltip>
                      <InlineStack align="end">
                        <Box>
                          <Button onClick={() => onClickAppHandler(post.key || post.title, post.buttonLink)}>
                            {post.buttonText || t('learn-more')}
                          </Button>
                        </Box>
                      </InlineStack>
                    </BlockStack>
                  </Box>
                </Box>
              ))}
        </CarouselWithPagination>
      </BlockStack>
    </CardWithDismiss>
  )
}

function PromotionsSkeleton() {
  return (
    <Card>
      <BlockStack gap={'500'}>
        <BlockStack gap="200">
          <InlineStack gap={'200'} wrap={false}>
            <SkeletonThumbnail />
            <Box paddingBlockStart="200" width="calc(100% - 168px)">
              <SkeletonBodyText lines={1} />
            </Box>
          </InlineStack>

          <SkeletonBodyText />
        </BlockStack>
        <InlineStack align="end">
          <Box width="100px">
            <SkeletonBodyText lines={1} />
          </Box>
        </InlineStack>
      </BlockStack>
    </Card>
  )
}

export default BlogPromotionCard

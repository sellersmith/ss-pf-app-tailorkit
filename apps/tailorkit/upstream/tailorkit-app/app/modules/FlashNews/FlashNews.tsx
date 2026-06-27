import { useEffect, useState } from 'react'
import { InlineGrid, Text } from '@shopify/polaris'
import { authenticatedFetch } from '~/shopify/fns.client'
import styles from './styles.module.css'

export default function FlashNews() {
  const [news, setNews] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchFlashNews = async () => {
      try {
        const response = await authenticatedFetch('/api/flash-news', { preferCache: true })

        if (response && Array.isArray(response)) {
          setNews(response)
        }
      } catch (error) {
        console.error('Error fetching flash news:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchFlashNews()
  }, [])

  useEffect(() => {
    if (news.length <= 1) return

    const getRandomInterval = () => Math.random() * 9000 + 1000 // 1-10 seconds

    const flashNews = () => {
      setCurrentIndex(prev => (prev + 1) % news.length)
    }

    const timeoutId = setTimeout(flashNews, getRandomInterval())

    return () => clearTimeout(timeoutId)
  }, [news, currentIndex])

  if (isLoading) {
    return null
  }

  if (news.length === 0) {
    return null
  }

  return (
    <InlineGrid gap="200" columns="20px 1fr" alignItems="center">
      <span className={styles.FlashNewsPulse}></span>
      <Text as="p" tone="success" variant="bodyLg">
        {news[currentIndex]}
      </Text>
    </InlineGrid>
  )
}

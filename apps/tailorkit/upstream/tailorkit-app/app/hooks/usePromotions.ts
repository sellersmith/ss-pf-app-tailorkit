import { useLayoutEffect, useMemo, useState } from 'react'

export interface PromoBanner {
  key: string
  bannerImageUrl: string
  startDate: string
  endDate: string
  buttonLink: string
}

interface PromoIntro {
  title?: string
  description?: string
  imageUrl?: string
}

interface PromoItem {
  position?: string
  startDate?: string
  endDate?: string
  title?: string
  description?: string
  imageUrl?: string
  buttonLink?: string
}

// Define promotion provider
const promotionProvider
  = 'https://script.google.com/macros/s/AKfycbwQIRwt1T-ydwVUaQ4Prz5bZ0M510xVVWQ4UYS7f5dwtL2ajWMLevQatNkDxkLIn8Ir/exec'

export default function usePromotions(props: { position: string }) {
  const { position } = props

  // Fetch promotions
  const [loading, setLoading] = useState(false)
  const [intro, setIntro] = useState<PromoIntro>({})
  const [items, setItems] = useState<PromoItem[]>([])
  const [promoBanners, setPromoBanners] = useState<PromoBanner[]>([])
  const now = useMemo(() => new Date().toISOString(), [])

  useLayoutEffect(() => {
    setLoading(true)
    fetch(promotionProvider)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        data.intro && setIntro(data.intro)
        data.items && setItems(data.items)
        data.promoBanners && setPromoBanners(data.promoBanners)
      })
      .catch(error => {
        console.error('Failed to fetch promotions:', error)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const activePromotions = useMemo(
    () =>
      items
        .filter(
          (promotion: PromoItem) =>
            (!position || promotion.position === position)
            && (!promotion.startDate || promotion.startDate <= now)
            && (!promotion.endDate || promotion.endDate >= now)
        )
        .sort(() => Math.random() - 0.5),
    [items, now, position]
  )

  /* Filter promo banners by date range */
  const activePromoBanners = useMemo(
    () =>
      promoBanners.filter(
        banner =>
          banner.bannerImageUrl
          && (!banner.startDate || banner.startDate <= now)
          && (!banner.endDate || banner.endDate >= now)
      ),
    [promoBanners, now]
  )

  return {
    intro,
    items,
    activePromotions,
    activePromoBanners,
    loading,
  }
}

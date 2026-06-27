import { useEffect, useState } from 'react'
import { fontLoader } from '../components/Text/instances'

export const useLoadFonts = (props: { fonts: { src: string; family: string }[] }) => {
  const { fonts = [] } = props
  const [fontLoading, setFontLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      setFontLoading(true)
      if (fonts.length > 0) {
        await Promise.all(
          fonts.map(async font => {
            await fontLoader.loadFont(font.family, font.src)
          })
        )
      }
      setFontLoading(false)
    })()
  }, [fonts])

  return { fontLoading }
}

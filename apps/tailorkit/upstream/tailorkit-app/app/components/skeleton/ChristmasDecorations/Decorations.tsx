import { memo } from 'react'

import { CandleIcon, GiftIcon, SantaHatIcon, TreeIcon } from './icons'
import useDevices from '~/utils/hooks/useDevice'

export const ChristmasDecorations = memo(function ChristmasDecorations() {
  const { isIOS } = useDevices()

  if (isIOS) return null

  return (
    <>
      {/* Santa hat on top */}
      <div className="christmas-decoration christmas-santa-hat">
        <SantaHatIcon />
      </div>

      {/* Left side: Gift + Candle */}
      <div className="christmas-decoration christmas-gift-left">
        <GiftIcon />
      </div>
      <div className="christmas-decoration christmas-candle-left">
        <CandleIcon />
      </div>

      {/* Right side: Gift + Tree */}
      <div className="christmas-decoration christmas-gift-right">
        <GiftIcon />
      </div>
      <div className="christmas-decoration christmas-tree-right">
        <TreeIcon />
      </div>
    </>
  )
})

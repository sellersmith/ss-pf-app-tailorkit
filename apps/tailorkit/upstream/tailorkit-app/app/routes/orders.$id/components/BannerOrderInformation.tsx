import type { BannerProps } from '@shopify/polaris'
import { Banner } from '@shopify/polaris'
import React, { useState } from 'react'

interface IBannerOrderInformationProps {
  tone: BannerProps['tone']
  message: string | React.ReactNode
}

function BannerOrderInformation(props: IBannerOrderInformationProps) {
  const [active, setActive] = useState(true)

  if (!active) return

  return (
    <Banner
      tone={props.tone}
      onDismiss={() => {
        setActive(false)
      }}
    >
      <p>{props.message}</p>
    </Banner>
  )
}

export default BannerOrderInformation

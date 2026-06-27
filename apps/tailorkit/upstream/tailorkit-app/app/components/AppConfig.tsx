import React from 'react'
import BlockLoading from './loading/BlockLoading'
import { useNavigation } from '@remix-run/react'

export default function AppConfig({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation()

  return process.env.NODE_ENV === 'test' || navigation.state === 'idle' ? (
    children
  ) : (
    <React.Fragment>
      <BlockLoading />
    </React.Fragment>
  )
}

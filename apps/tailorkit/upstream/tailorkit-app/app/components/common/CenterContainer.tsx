import type { CSSProperties } from 'react'

export function CenterContainer(props: { children: React.ReactNode; style?: CSSProperties }) {
  const { children, style } = props
  return (
    <div
      style={{
        display: 'grid',
        placeContent: 'center',
        height: '100%',
        width: '100%',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

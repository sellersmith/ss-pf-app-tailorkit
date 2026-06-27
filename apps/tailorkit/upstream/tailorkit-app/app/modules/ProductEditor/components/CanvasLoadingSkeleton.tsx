import BlockLoading from '~/components/loading/BlockLoading'

export default function CanvasLoadingSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
      }}
    >
      <div
        style={{
          flex: 1,
          width: `calc(100vw - max(570px, 40vw) - var(--integration-container-width))`,
          height: '100%',
          overflow: 'auto',
          transition: 'padding-right 0.15s ease',
        }}
      >
        <div
          style={{
            background: 'var(--p-color-bg-fill-disabled)',
            padding: 'var(--p-space-200)',
            height: '100%',
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
            }}
          >
            <BlockLoading />
          </div>
        </div>
      </div>
    </div>
  )
}

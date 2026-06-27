import { memo } from 'react'

import { SEASONAL_THEME } from '~/constants/seasonal'

import { ChristmasDecorations, Snowflakes } from './ChristmasDecorations'

const PageLoadingSkeleton = memo(
  function PageLoadingSkeleton() {
    const isChristmas = SEASONAL_THEME.CHRISTMAS_ENABLED

    return (
      <PageContainer alignItems="center">
        {isChristmas && <Snowflakes />}
        <div className="page-loading-container">
          <svg
            id="Layer_2"
            data-name="Layer 2"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            viewBox="0 0 1200 1200"
            style={{ zIndex: 2 }}
          >
            <defs>
              <clipPath id="clippath">
                <rect className="cls2" y="840" width="1200" height="360" />
              </clipPath>
            </defs>
            <g id="Layer_1-2" data-name="Layer 1">
              <g>
                <rect className="cls6" width="1200" height="1200" rx="55.58" ry="55.58" />
                <g className="cls1">
                  <g>
                    <path
                      className="cls4"
                      // eslint-disable-next-line max-len
                      d="M0,840.78c185.09,53.76,386.53,88.87,592.16,88.87s418.7-33.77,606.84-89.66h1v303.99c0,30.93-25.08,56.01-56.01,56.01H56.01c-30.93,0-56.01-25.08-56.01-56.01v-303.21Z"
                    />
                    <path
                      className="cls5"
                      // eslint-disable-next-line max-len
                      d="M439.67,1034.62c8.18-7.8,20.95-7.8,30.4-1.6,31.45,20.64,77.23,32.75,129.6,32.75s98.74-12.12,130.37-32.77c9.46-6.18,22.23-6.18,30.41,1.62,9.02,8.6,8.9,23.12-1.27,30.31-40.86,28.93-97.58,45.84-159.51,45.84s-118.04-16.9-158.73-45.82c-10.16-7.21-10.27-21.73-1.26-30.33Z"
                    />
                  </g>
                </g>
                <path className="cls3" d="M545.11,792h107.38" />
                <g className="notificationPulse">
                  <path
                    className="cls7"
                    // eslint-disable-next-line max-len
                    d="M531,261c0-38.11,30.89-69,69-69s69,30.89,69,69v33.9c0,6.13-4.97,11.1-11.1,11.1h-126.9v-45Z"
                  />
                  <rect className="cls7" x="531" y="321" width="138" height="327" rx="15" ry="15" />
                  <path
                    className="cls7"
                    // eslint-disable-next-line max-len
                    d="M607.2,755.21c-3.5,5.05-10.89,5.05-14.4,0l-54.18-78.16c-4.1-5.91.07-14.05,7.2-14.05h108.37c7.13,0,11.3,8.14,7.2,14.05l-54.18,78.16Z"
                  />
                </g>
                <path className="cls3" d="M786,144h-308.85c-104.29,0-116,144,11.64,144h44.49" />
              </g>
            </g>
          </svg>
          {isChristmas && <ChristmasDecorations />}
        </div>
      </PageContainer>
    )
  },
  () => true
)

const PageContainer = ({
  children,
  alignItems = 'flex-start',
  justifyContent = 'center',
}: {
  children: React.ReactNode
  alignItems?: 'center' | 'flex-start'
  justifyContent?: 'center' | 'flex-start'
}) => {
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        justifyContent,
        alignItems,
        width: '100vw',
        height: '100vh',
      }}
    >
      {children}
    </div>
  )
}

export default PageLoadingSkeleton

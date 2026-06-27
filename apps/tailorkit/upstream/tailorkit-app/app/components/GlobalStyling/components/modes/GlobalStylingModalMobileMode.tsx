import { useTranslation } from 'react-i18next'
import type { GlobalStylingModeProps } from '.'

interface GlobalStylingModalMobileModeProps extends Omit<GlobalStylingModeProps, 'mode'> {
  title: string
}

export function GlobalStylingModalMobileMode({ content, title }: GlobalStylingModalMobileModeProps) {
  const { t } = useTranslation()
  return (
    <div>
      <div
        style={{
          boxShadow: 'unset',
          borderWidth: 'var(--emtlkit-box-border-width, 1px)',
          borderStyle: 'var(--emtlkit-box-border-style, solid)',
          borderColor: 'var(--emtlkit-box-border-color, #E3E3E3)',
          maxHeight: '100vh',
        }}
        className="emtlkit-modal emtlkit-modal--medium"
      >
        {/* Modal Header */}
        <div className="emtlkit-modal__header">
          <h3 className="emtlkit-modal__title">{title}</h3>
          <button className="emtlkit-modal__close-button" disabled>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="#999999"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Modal Content - Mobile Layout (Column) */}
        <div
          style={{ padding: '16px', flexDirection: 'column', alignItems: 'center' }}
          className="emtlkit-modal__customizer-content"
        >
          {/* Product Image Section - Mobile Size */}
          <div style={{ width: '100%', height: '300px' }} className="emtlkit-modal__product-image-container">
            <div style={{ width: '100%', height: '100%' }} className="emtlkit-modal__product-image">
              <img
                style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
                src={'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Product_Thumbnail.webp?v=1758510459'}
                alt="Placeholder Product"
              />
            </div>
          </div>

          {/* Customizer Content - Mobile Width */}
          <div style={{ width: '100%' }} className="emtlkit-modal__scrollable-content">
            <div className="emtlkit-modal__content-wrapper">{content}</div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="emtlkit-modal__footer">
          <div className="emtlkit-modal__actions">
            <button className="emtlkit-button emtlkit-button--secondary">{t('close')}</button>
            <button className="emtlkit-button emtlkit-button--primary">{t('add-to-cart')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

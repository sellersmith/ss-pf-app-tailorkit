/** @jsxImportSource preact */
import { Modal } from '../../../../assets/components/preact/commons/modal'

export interface ColourGuideOption {
  id: string
  name: string
  value: string
  description?: string
}

interface ColourGuideModalProps {
  open: boolean
  onClose: () => void
  imageUrl: string
  description?: string
  optionSetLabel?: string
  options: ColourGuideOption[]
}

/**
 * Reference image + dynamic colour-name list, shown when buyer clicks the
 * "Colour guide" link below a Text Colour option set on the storefront.
 *
 * Reuses the base Modal infra (Portal, backdrop, Escape close, focus trap).
 * Pricing is intentionally omitted (locked decision 2026-05-18 — names only).
 */
export function ColourGuideModal({
  open,
  onClose,
  imageUrl,
  description,
  optionSetLabel,
  options,
}: ColourGuideModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Colour Guide"
      size="small"
      className="emtlkit-colour-guide-modal"
      showCloseButton
      footerContent={null}
    >
      <div className="emtlkit-colour-guide__body">
        <img
          src={imageUrl}
          alt={optionSetLabel || 'Colour guide'}
          className="emtlkit-colour-guide__image"
          loading="lazy"
        />
        {description && <p className="emtlkit-colour-guide__intro">{description}</p>}
        {options.length > 0 && (
          <ul className="emtlkit-colour-guide__swatches">
            {options.map(opt => (
              <li key={opt.id} className="emtlkit-colour-guide__swatch-row">
                <span
                  className="emtlkit-colour-guide__swatch"
                  style={{ backgroundColor: opt.value }}
                  aria-hidden="true"
                />
                <div className="emtlkit-colour-guide__swatch-info">
                  <span className="emtlkit-colour-guide__swatch-name">{opt.name}</span>
                  {opt.description && (
                    <span className="emtlkit-colour-guide__swatch-description">{opt.description}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

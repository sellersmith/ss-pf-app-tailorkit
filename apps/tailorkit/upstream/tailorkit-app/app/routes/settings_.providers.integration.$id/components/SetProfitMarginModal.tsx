import { Box, TextField } from '@shopify/polaris'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_PROFIT_MARGIN, SET_PROFIT_MARGIN_MODAL_ID } from '../constants'
import { Modal, TitleBar } from '@shopify/app-bridge-react'
import type { UseImportedProductsListReturn } from '../hooks/useImportedProductsList'

interface IProfitMarginProps {
  active: boolean
  productIds: string[]
  defaultProfitMargin: number
  onClose: () => void
  handleSetProfitMargin: UseImportedProductsListReturn['handleSetProfitMargin']
}

export const SetProfitMarginModal = (props: IProfitMarginProps) => {
  const { active, handleSetProfitMargin, productIds, onClose, defaultProfitMargin } = props
  const { t } = useTranslation()

  const [profitMargin, setProfitMargin] = useState(defaultProfitMargin)
  const [saving, setSaving] = useState(false)

  const handleChangeProfitMargin = useCallback((value: string) => {
    setProfitMargin(+value)
  }, [])

  const handleBlur = useCallback(async () => {
    const realProfitMargin = profitMargin < MAX_PROFIT_MARGIN ? profitMargin : MAX_PROFIT_MARGIN
    setProfitMargin(Math.max(realProfitMargin, 0))
  }, [profitMargin])

  const handleUpdateProfitMargin = useCallback(async () => {
    try {
      setSaving(true)
      await handleSetProfitMargin(Number(profitMargin), productIds)
      onClose()
    } catch (e) {
      console.error('Failed to update profit margin', e)
    } finally {
      setSaving(false)
    }
  }, [handleSetProfitMargin, onClose, productIds, profitMargin])

  const onHide = useCallback(async () => {
    onClose()
  }, [onClose])

  return (
    <Modal id={SET_PROFIT_MARGIN_MODAL_ID} open={active} onHide={onHide}>
      <TitleBar title={t('set-profit-margin')}>
        <button variant={'primary'} loading={saving} onClick={handleUpdateProfitMargin}>
          {t('done')}
        </button>
        <button onClick={onHide}>{t('cancel')}</button>
      </TitleBar>
      <Box padding={'400'}>
        <div className="profit-margin-textfield">
          <TextField
            label={t('profit-margin-label-on-modal')}
            autoComplete={'off'}
            value={profitMargin.toString()}
            placeholder={t('input-your-profit-margin')}
            suffix={'%'}
            type="number"
            onChange={handleChangeProfitMargin}
            onBlur={handleBlur}
            size="slim"
            min={0}
          />
        </div>
      </Box>
    </Modal>
  )
}

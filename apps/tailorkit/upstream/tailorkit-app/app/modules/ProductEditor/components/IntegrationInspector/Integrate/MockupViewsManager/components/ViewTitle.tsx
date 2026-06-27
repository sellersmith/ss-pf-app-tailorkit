import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '~/libs/external-store'
import TextFieldValidation from '~/modules/TemplateEditor/common/text-field-validation'
import type { WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import withMockup from '~/modules/ProductEditor/withMockup'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { useDebounce } from '~/utils/hooks/useDebounce'
import type { MockupView } from '~/types/integration'

interface IViewTitleProps extends WithVariantsProps {
  view: MockupView
}

function ViewTitle(props: IViewTitleProps) {
  const { mockupId, view } = props
  const { t } = useTranslation()
  const viewTitle = useStore(
    IntegrationStore,
    s => s.variants.find(v => v.mockup._id === mockupId)?.mockup?.views?.find(v => v._id === view._id)?.title
  )
  const [tempViewTitle, setTempViewTitle] = useState(viewTitle || t('mockup-views'))
  const debouncedViewTitle = useDebounce(tempViewTitle, 300)

  useEffect(() => {
    if (debouncedViewTitle !== viewTitle) {
      IntegrationStore.dispatch({
        type: 'UPDATE_VIEW_TITLE',
        payload: { mockupId, viewId: view._id, title: debouncedViewTitle || '' },
      })
    }
  }, [debouncedViewTitle, mockupId, view._id, viewTitle])

  return (
    <TextFieldValidation
      label={t('view-title')}
      autoComplete="off"
      value={tempViewTitle}
      onChange={setTempViewTitle}
      onBlur={() => (!tempViewTitle ? setTempViewTitle(t('mockup-views')) : undefined)}
      placeholder={t('enter-a-title-for-the-view')}
      showCharacterCount
      maxLength={60}
    />
  )
}

export default withMockup(ViewTitle)

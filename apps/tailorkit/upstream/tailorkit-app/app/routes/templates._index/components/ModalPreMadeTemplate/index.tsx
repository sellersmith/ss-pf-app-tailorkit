import { useNavigate } from '@remix-run/react'
import { ClickContext } from '~/models/ClipartClickEvent'
import { ClipartsSelector } from '~/modules/modals/ClipartsSelector'
import { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { buildUrlWithParams } from '~/utils/buildUrlWithParams'
import { uuid } from '~/utils/uuid'

export default function ModalPreMadeTemplate(props: {
  active: boolean
  withQuickTour?: boolean
  toggleModalCreateTemplate: () => void
}) {
  const { active, withQuickTour, toggleModalCreateTemplate } = props
  const navigate = useNavigate()

  const onSelect = async (clipartsSelected: { _id: string; type: TEMPLATE_TYPE }[]) => {
    if (!clipartsSelected[0]._id) return

    const templateId = uuid()
    const premadeTemplateId = clipartsSelected[0]._id
    const url = buildUrlWithParams(`/templates/${templateId}`, {
      premadeTemplateId,
      ...(withQuickTour && { tour: USER_JOURNEY_TYPE.TEMPLATE_EDITOR_QUICK_TOUR }),
    })
    navigate(url)
  }

  return (
    <ClipartsSelector
      active={active}
      defaultClipartSource={TEMPLATE_TYPE.PREMADE_TEMPLATE}
      trackingContext={ClickContext.MODAL_TEMPLATE_LISTING}
      onSelect={onSelect}
      onClose={toggleModalCreateTemplate}
    />
  )
}

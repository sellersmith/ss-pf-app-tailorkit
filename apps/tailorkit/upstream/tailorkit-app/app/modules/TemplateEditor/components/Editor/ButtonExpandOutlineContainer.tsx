import { Fragment } from 'react/jsx-runtime'
import ButtonExpandOutline from '../Outline/Header/ButtonExpandOutline'
import useDevices from '~/utils/hooks/useDevice'
import { TemplateEditorStore } from '~/stores/modules/template'
import { useStore } from '~/libs/external-store'

export default function ButtonExpandOutlineContainer() {
  const { isDesktopView } = useDevices()
  const sidebarActive = useStore(TemplateEditorStore, state => state.sidebarActive)
  const isSidebarOpen = sidebarActive

  return (
    <Fragment>
      {isDesktopView && !isSidebarOpen && (
        <div
          style={{
            position: 'absolute',
            left: '12px',
            top: '12px',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '4px',
            zIndex: 30,
          }}
        >
          <ButtonExpandOutline />
        </div>
      )}
    </Fragment>
  )
}

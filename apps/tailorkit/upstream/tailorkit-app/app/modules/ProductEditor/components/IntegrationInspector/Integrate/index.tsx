import { Box } from '@shopify/polaris'
import PrintAreaTemplate from './PrintAreaTemplate'
import MockupLayersManager from './MockupLayersManager'

function IntegrateInspectorContainer() {
  return (
    <Box>
      <PrintAreaTemplate />

      <MockupLayersManager />
    </Box>
  )
}

export default IntegrateInspectorContainer

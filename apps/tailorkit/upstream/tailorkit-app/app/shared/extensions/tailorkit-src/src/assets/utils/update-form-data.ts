// Type Definitions
export type MetaData = { [key: string]: any }
export type DisplayData = { label: string; type: string; value: string }[]
export type DisplayDataMap = { [key: string]: DisplayData }

// Helper functions

/**
 * Updates the metadata for a specific print area and layer.
 * @param printAreaId - The ID of the print area.
 * @param layerId - The ID of the layer.
 * @param layerMetaData - The existing metadata for the layer.
 * @param newMetaData - New metadata to merge into the existing layer metadata.
 */
export function updateMetaData(args: {
  metaData: MetaData
  printAreaId: string
  layerId: string
  layerMetaData: any
  newMetaData: any
}): void {
  const { metaData, printAreaId, layerId, layerMetaData, newMetaData } = args
  metaData[printAreaId][layerId] = JSON.stringify({
    ...layerMetaData,
    ...newMetaData,
  })
}

/**
 * Adds display data for a specific print area and layer if a label is provided.
 * @param printAreaId - The ID of the print area.
 * @param layerId - The ID of the layer.
 * @param label - The label for the display data entry.
 * @param type - The type of the option.
 * @param value - The value of the option.
 */
export function addDisplayData(args: {
  displayData: { [printAreaId: string]: DisplayDataMap }
  printAreaId: string
  layerId: string
  label: string | null
  type: string
  value: string
}): void {
  const { displayData, label, layerId, printAreaId, type, value } = args
  if (label) {
    if (!displayData[printAreaId]) {
      displayData[printAreaId] = {}
    }
    if (!displayData[printAreaId][layerId]) {
      displayData[printAreaId][layerId] = []
    }
    displayData[printAreaId][layerId].push({
      label,
      type,
      value,
    })
  }
}

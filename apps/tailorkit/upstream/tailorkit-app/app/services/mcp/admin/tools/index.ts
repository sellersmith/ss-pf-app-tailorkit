import assistantTool from './assistant'
import manageLayerTool from './layer/manageLayerTool'
import createTemplateTool from './template/createTemplateTool'
import readCollectionDataTool from './commons/readCollectionDataTool'

const TOOLS = [assistantTool, createTemplateTool, manageLayerTool, readCollectionDataTool]

export { TOOLS }

/**
 * Service adapter for layer operations mapping intent types to LayerExecutor methods.
 */

import { TEMPLATE_INTENT_TYPES_MAP } from '../../constants/templates'
import { LayerExecutor } from '../../services/executors/LayerExecutor'
import type { ChatInvoker } from '../../services/ProductIntentAnalyzer'
import type { SupervisorState } from '~/libs/langchain/supervisor'
import type { TemplateContext } from '../context/TemplateContextProvider'
/** Service layer executing layer operations with standardized response format. */
export class LayerExecuteService {
  /** Core layer executor instance for performing operations */
  private executor: LayerExecutor

  /** Creates LayerExecuteService with AI service for layer operations. */
  constructor(chatInvoker: ChatInvoker) {
    this.executor = new LayerExecutor(chatInvoker)
  }

  /** Executes layer function routing to LayerExecutor methods with standardized responses. */
  async executeFunction(functionName: string, parameters: any, context: SupervisorState['context'] & TemplateContext) {
    switch (functionName) {
      case TEMPLATE_INTENT_TYPES_MAP.layer_create:
        return {
          response: '✅ Layer created',
          validationPassed: true,
          data: await this.executor.createLayer({ parameters, context }),
        }
      case TEMPLATE_INTENT_TYPES_MAP.layer_edit:
        return {
          response: '✅ Layer updated',
          validationPassed: true,
          data: await this.executor.editLayer({
            parameters,
            context,
          }),
        }
      case TEMPLATE_INTENT_TYPES_MAP.layer_delete:
        return {
          response: '✅ Layer deleted',
          validationPassed: true,
          data: await this.executor.deleteLayer(parameters),
        }
      default:
        return { response: `Layer function ${functionName} executed`, validationPassed: true }
    }
  }
}

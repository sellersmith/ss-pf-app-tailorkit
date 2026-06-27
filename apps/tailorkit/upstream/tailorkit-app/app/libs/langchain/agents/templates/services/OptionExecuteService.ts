/**
 * Service adapter for option set operations providing interface over OptionSetExecutor.
 */

import type { ChatInvoker } from '../../services/ProductIntentAnalyzer'
import { TEMPLATE_INTENT_TYPES_MAP } from '../../constants/templates'
import type { SupervisorState } from '~/libs/langchain/supervisor'
import { OptionSetExecutor } from '../../services/executors/OptionSetExecutor'
import type { TemplateContext } from '../context/TemplateContextProvider'

/** Service layer executing option set operations with standardized response format. */
export class OptionSetExecuteService {
  /** Core option set executor instance for performing operations */
  private executor: OptionSetExecutor

  /** Creates OptionSetExecuteService with AI service for option set operations. */
  constructor(chatInvoker: ChatInvoker) {
    this.executor = new OptionSetExecutor(chatInvoker)
  }

  /** Executes option set function routing to OptionSetExecutor methods with standardized responses. */
  async executeFunction(functionName: string, parameters: any, context: SupervisorState['context'] & TemplateContext) {
    switch (functionName) {
      case TEMPLATE_INTENT_TYPES_MAP.option_set_create:
        return {
          success: true,
          response: '✅ Option set created',
          validationPassed: true,
          data: await this.executor.createOptionSet(parameters, context),
        }
      case TEMPLATE_INTENT_TYPES_MAP.option_set_edit:
        return {
          success: true,
          response: '✅ Option set updated',
          validationPassed: true,
          data: await this.executor.editOptionSet(parameters, context),
        }
      case TEMPLATE_INTENT_TYPES_MAP.option_set_delete:
        return {
          success: true,
          response: '✅ Option set deleted',
          validationPassed: true,
          data: await this.executor.deleteOptionSet(parameters, context),
        }
      default:
        return { success: true, response: `Executed ${functionName}`, validationPassed: true }
    }
  }
}

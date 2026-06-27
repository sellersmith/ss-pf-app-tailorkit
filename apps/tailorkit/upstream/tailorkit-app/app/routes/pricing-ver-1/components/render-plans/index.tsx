import { Box } from '@shopify/polaris'
import { renderCappedAmount } from './render-capped-amount'
import { renderChoosePlan } from './render-choose-plan'
import { renderMonthlyFreeOrders } from './render-monthly-free-oder'
import { renderPlanName } from './render-plan-name'
import { renderPrice } from './render-price'
import { renderTransactionFee } from './render-transaction-free'
import type { IRenderPlanProps } from './type'

/**
 * Render pricing plans
 *
 * @param props IRenderPlanProps
 * @returns
 */
function renderPlans(props: IRenderPlanProps) {
  return (
    <Box>
      {/* Render plan name */}
      {renderPlanName(props)}

      {/* Render price  */}
      {renderPrice(props)}

      {/* Render monthly free orders */}
      {renderMonthlyFreeOrders(props)}

      {/* Render transaction fee */}
      {renderTransactionFee(props)}

      {/* Render capped amount */}
      {renderCappedAmount(props)}

      {/* Render choose plan */}
      {renderChoosePlan(props)}
    </Box>
  )
}

export default renderPlans

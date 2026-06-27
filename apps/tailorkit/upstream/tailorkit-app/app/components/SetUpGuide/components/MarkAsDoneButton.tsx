import { Tooltip } from '@shopify/polaris'
import { useMemo } from 'react'
import { ProcessCompletedIcon, ProcessingIcon } from '~/assets/icons'
import styles from '../styles.module.css'

export const MarkAsDoneButton = (props: {
  complete: boolean
  loading: boolean
  tooltipContent?: { markAsDone: string; markAsNotDone: string }
  allowMarkAsDone?: boolean
  completeItem: () => void
}) => {
  const { complete, loading, tooltipContent, allowMarkAsDone, completeItem } = props

  const renderMarkAsDoneButton = useMemo(() => {
    return (
      <div
        style={{ cursor: allowMarkAsDone ? 'pointer' : 'default' }}
        onClick={allowMarkAsDone ? completeItem : undefined}
      >
        <span className={`${styles.loadingProcessIcon}${loading ? ` ${styles.loading}` : ''}`}>
          {!loading && complete ? ProcessCompletedIcon : ProcessingIcon}
        </span>
      </div>
    )
  }, [allowMarkAsDone, complete, loading, completeItem])

  return tooltipContent ? (
    <Tooltip content={complete ? tooltipContent.markAsNotDone : tooltipContent.markAsDone} activatorWrapper="div">
      {renderMarkAsDoneButton}
    </Tooltip>
  ) : (
    renderMarkAsDoneButton
  )
}

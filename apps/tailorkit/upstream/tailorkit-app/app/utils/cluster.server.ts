import cluster from 'cluster'

interface ClusterTaskConfig {
  taskFn: () => void | Promise<void>
  processId?: string
  onError?: (error: unknown) => void
}

/**
 * Run a task only on the primary cluster worker
 *
 * @param ClusterTaskConfig The task to run
 */
export function runClusterTask({ taskFn, processId, onError = console.error }: ClusterTaskConfig) {
  const workerId = processId || process.env.pm_id // Use PM2's process ID for workers

  try {
    if (cluster.isPrimary) {
      console.log(`[Cluster] Running task on primary cluster`)
      taskFn()
      return
    }

    if (!workerId) {
      console.warn('[Cluster] No worker ID found. Task will not be executed.')
      return
    }

    console.log(`[Cluster] Worker ${workerId} checking if eligible to run task`)

    // Only run task if this is the primary worker (id === '0')
    if (workerId === '0') {
      console.log(`[Cluster] Worker ${workerId} executing task`)
      taskFn()
    } else {
      console.log(`[Cluster] Worker ${workerId} skipping task (not primary worker)`)
    }
  } catch (error) {
    console.error(`[Cluster] Error executing task:`, error)
    onError(error)
  }
}

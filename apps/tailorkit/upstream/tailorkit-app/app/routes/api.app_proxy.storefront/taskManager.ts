import { TaskStatus } from '~/models/TaskStatus.server'
import { uuid } from '~/utils/uuid'

/**
 * Simple in-memory task manager for development
 * Note: This should be replaced with Redis or another persistent store in production
 */
class InMemoryTaskManager {
  private tasks: Map<string, { status: (typeof TaskStatus)[keyof typeof TaskStatus]; data?: any; error?: string }>
    = new Map()

  /**
   * Create a new task and return its ID
   */
  createTask(): string {
    const taskId = uuid()
    this.tasks.set(taskId, { status: TaskStatus.PENDING })
    return taskId
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string) {
    return this.tasks.get(taskId)
  }

  /**
   * Update task status and optional data/error
   */
  updateTask(taskId: string, status: (typeof TaskStatus)[keyof typeof TaskStatus], data?: any, error?: string) {
    this.tasks.set(taskId, { status, data, error })
  }

  /**
   * Delete task by ID
   */
  deleteTask(taskId: string) {
    this.tasks.delete(taskId)
  }
}

// Create a singleton instance
const taskManager = new InMemoryTaskManager()

export default taskManager

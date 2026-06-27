import { createClient } from 'redis'
import { randomUUID } from 'crypto'
import type { ITaskResult, TaskStatusType } from '~/models/TaskStatus.server'
import { TaskStatus } from '~/models/TaskStatus.server'
import { ONE_SECOND_IN_MILLISECONDS } from '~/constants'

class RedisTaskManager {
  private redisClient: ReturnType<typeof createClient>
  private readonly prefix = 'task:'
  private readonly expireTime = 15 * ONE_SECOND_IN_MILLISECONDS // 15 minutes in seconds

  constructor() {
    this.redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: retries => {
          if (retries > 10) return new Error('Redis connection retries exhausted')
          return Math.min(retries * 1000, 10000)
        },
      },
    })

    this.redisClient.on('error', error => {
      console.error('Redis Task Manager Error:', error)
    })

    this.redisClient.connect().catch(error => {
      console.error('Redis Task Manager Connection Error:', error)
    })
  }

  async createTask(): Promise<string> {
    const taskId = randomUUID()
    const task: ITaskResult = {
      taskId,
      status: TaskStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.redisClient.set(this.getKey(taskId), JSON.stringify(task), { EX: this.expireTime })

    return taskId
  }

  async updateTask(taskId: string, status: TaskStatusType, result?: any, error?: string): Promise<void> {
    const taskJson = await this.redisClient.get(this.getKey(taskId))
    if (!taskJson) throw new Error(`Task ${taskId} not found`)

    const task: ITaskResult = JSON.parse(taskJson)
    const updatedTask: ITaskResult = {
      ...task,
      status,
      result,
      error,
      updatedAt: new Date(),
    }

    await this.redisClient.set(this.getKey(taskId), JSON.stringify(updatedTask), { EX: this.expireTime })
  }

  async getTask(taskId: string): Promise<ITaskResult | null> {
    const taskJson = await this.redisClient.get(this.getKey(taskId))
    return taskJson ? JSON.parse(taskJson) : null
  }

  private getKey(taskId: string): string {
    return `${this.prefix}${taskId}`
  }

  async dispose(): Promise<void> {
    await this.redisClient.quit()
  }
}

// Export singleton instance
export const redisTaskManager = new RedisTaskManager()

// Handle graceful shutdown
process.on('SIGTERM', () => redisTaskManager.dispose())
process.on('SIGINT', () => redisTaskManager.dispose())

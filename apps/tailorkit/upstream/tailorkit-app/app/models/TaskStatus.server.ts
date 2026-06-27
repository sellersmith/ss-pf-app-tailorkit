import { z } from 'zod'

export const TaskStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const

export const TaskStatusSchema = z.enum([
  TaskStatus.PENDING,
  TaskStatus.PROCESSING,
  TaskStatus.COMPLETED,
  TaskStatus.FAILED,
])

export type TaskStatusType = z.infer<typeof TaskStatusSchema>

export interface ITaskResult {
  taskId: string
  status: TaskStatusType
  result?: any
  error?: string
  createdAt: Date
  updatedAt: Date
}

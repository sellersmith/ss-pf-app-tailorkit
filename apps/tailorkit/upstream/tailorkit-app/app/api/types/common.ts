export type Pagination = {
  page?: number
  limit?: number
  sort?: string
}

export type ListResponse<T> = {
  items: T[]
  total?: number
  page?: number
  limit?: number
}

export type ApiSuccess<T> = {
  success: true
  data?: T
  message?: string | { text: string; params?: Record<string, unknown> }
}

export type ApiFailure = {
  success: false
  message: string
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure

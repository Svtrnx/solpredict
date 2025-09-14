export interface PaginationState {
  currentPage: number
  totalPages: number
  itemsPerPage: number
  totalItems: number
}

export interface LoadingState {
  achievements: boolean
  dashboard: boolean
  userData: boolean
  bets: boolean
}

export interface ApiResponse<T> {
  data: T
  totalItems: number
  totalPages: number
  currentPage: number
}

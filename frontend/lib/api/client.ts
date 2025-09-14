export class ApiClient {
  private baseUrl: string

  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl
  }

  async get<T>(endpoint: string): Promise<T> {
    throw new Error(`API endpoint ${endpoint} not implemented yet`)
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, 500))
    throw new Error(`API endpoint ${endpoint} not implemented yet`)
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, 500))
    throw new Error(`API endpoint ${endpoint} not implemented yet`)
  }

  async delete<T>(endpoint: string): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, 500))
    throw new Error(`API endpoint ${endpoint} not implemented yet`)
  }
}

export const apiClient = new ApiClient()

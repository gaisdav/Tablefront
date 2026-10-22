import { http } from '@/api/client'
import type { LoginRequest, LoginResponse } from '@/types/api'

export const authApi = {
  login(credentials: LoginRequest): Promise<LoginResponse> {
    return http.post<LoginResponse>('/auth/login', { body: credentials })
  },
}

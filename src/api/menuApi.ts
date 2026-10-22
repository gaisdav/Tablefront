import { http } from '@/api/client'
import type { MenuItemsQuery } from '@/types/api'
import type { Category, MenuItem } from '@/types/domain'

export const menuApi = {
  listCategories(signal?: AbortSignal): Promise<Category[]> {
    return http.get<Category[]>('/categories', { signal })
  },

  listMenuItems(query: MenuItemsQuery = {}, signal?: AbortSignal): Promise<MenuItem[]> {
    return http.get<MenuItem[]>('/menu-items', { query, signal })
  },
}

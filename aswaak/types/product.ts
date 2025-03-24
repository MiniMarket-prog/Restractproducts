export interface Category {
  id: string
  name: string
}

export interface Product {
  id?: string
  name: string
  barcode?: string
  price: string
  stock?: number
  min_stock?: number
  image?: string
  category?: Category | null | string
  category_id?: string | null
  isLowStock?: boolean
  isExpiringSoon?: boolean
  purchase_price?: string | number | null
  quantity?: string | null
  expiry_date?: string | null
  expiry_notification_days?: number | null
  created_at?: string
  updated_at?: string
  created_by?: string
  updated_by?: string
  categories?: Category | null
}

export interface ProductFetchResult {
  name: string
  price: string
  image: string
  description?: string
  category: string
  isInStock: boolean
}


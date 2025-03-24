export interface Category {
  id: string
  name: string
  description?: string
  created_at?: string
  updated_at?: string
}

export interface Product {
  id?: string
  name: string // Required field
  barcode?: string
  price?: string
  stock?: number
  min_stock?: number
  image?: string
  category_id?: string | null
  category?: Category | null
  quantity?: string
  purchase_price?: string
  expiry_date?: string
  expiry_notification_days?: number
  created_at?: string
  updated_at?: string
  created_by?: string
  updated_by?: string
  isLowStock?: boolean
  isExpiringSoon?: boolean
  categories?: Category | null // For backward compatibility
}

export interface ProductFetchResult {
  name?: string
  price?: string
  image?: string
  barcode?: string
  quantity?: string
}


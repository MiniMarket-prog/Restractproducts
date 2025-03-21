export interface Category {
  id: string
  name: string
  created_at?: string
}

export interface Product {
  id?: string
  name: string
  price: string
  barcode: string | null
  stock: number
  min_stock: number
  image?: string | null
  category_id?: string | null
  created_at?: string
  purchase_price?: number | null
  expiry_date?: string | null
  expiry_notification_days?: number | null
  quantity?: string | null // Add quantity field

  // UI-only properties (not stored in DB)
  category?: Category | string | null
  categories?: Category | null // Add this to match Supabase's join result
  isLowStock?: boolean
  isExpiringSoon?: boolean
  source?: string // Add source to track which website provided the data
}

export interface ProductFetchResult {
  name: string
  price: string
  image?: string
  description?: string
  category?: string
  quantity?: string // Add quantity field
}


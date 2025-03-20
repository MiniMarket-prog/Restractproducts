export interface Category {
  id: string
  name: string
  created_at?: string
}

export interface Product {
  id?: string
  name: string
  price: string
  barcode: string | null // Changed from string to string | null
  stock: number
  min_stock: number
  image?: string | null
  category_id?: string | null
  created_at?: string
  purchase_price?: number | null
  expiry_date?: string | null // Ensure this is defined as potentially null
  expiry_notification_days?: number | null

  // UI-only properties (not stored in DB)
  category?: Category
  isLowStock?: boolean
  isExpiringSoon?: boolean
  categories?: any // Added to handle the nested categories from Supabase
}

export interface ProductFetchResult {
  name: string
  price: string
  image?: string
  description?: string
}


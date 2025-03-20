export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          price: string
          barcode: string | null
          stock: number
          min_stock: number
          image: string | null
          category_id: string | null
          created_at: string
          purchase_price: number | null
          expiry_date: string | null
          expiry_notification_days: number | null
        }
        Insert: {
          id?: string
          name: string
          price: string
          barcode?: string | null
          stock?: number
          min_stock?: number
          image?: string | null
          category_id?: string | null
          created_at?: string
          purchase_price?: number | null
          expiry_date?: string | null
          expiry_notification_days?: number | null
        }
        Update: {
          id?: string
          name?: string
          price?: string
          barcode?: string | null
          stock?: number
          min_stock?: number
          image?: string | null
          category_id?: string | null
          created_at?: string
          purchase_price?: number | null
          expiry_date?: string | null
          expiry_notification_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}


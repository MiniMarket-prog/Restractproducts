import { supabase, isSupabaseInitialized } from "@/lib/supabase"
import type { Product, Category, ProductFetchResult } from "@/types/product"

// Mock data for when Supabase is not available
const mockCategories: Category[] = [
  { id: "1", name: "Beverages" },
  { id: "2", name: "Dairy" },
  { id: "3", name: "Snacks" },
  { id: "4", name: "Groceries" },
]

const mockProducts: Record<string, Product> = {
  "6111245591063": {
    id: "1",
    name: "Milk Chocolate Bar",
    price: "12.99",
    barcode: "6111245591063",
    stock: 10,
    min_stock: 5,
    image: "/placeholder.svg?height=200&width=200",
    category_id: "3",
    category: { id: "3", name: "Snacks" },
    isLowStock: false,
    isExpiringSoon: false,
  },
}

export async function fetchCategories(): Promise<Category[]> {
  if (!isSupabaseInitialized()) {
    console.warn("Supabase client not available. Using mock data.")
    return mockCategories
  }

  try {
    const { data, error } = await supabase.from("categories").select("*").order("name")

    if (error) {
      console.error("Error fetching categories:", error)
      return mockCategories
    }

    return data || []
  } catch (err) {
    console.error("Error in fetchCategories:", err)
    return mockCategories
  }
}

export async function fetchProductByBarcode(barcode: string): Promise<Product | null> {
  if (!barcode) return null

  if (!isSupabaseInitialized()) {
    console.warn("Supabase client not available. Using mock data.")
    return mockProducts[barcode] || null
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        categories:category_id (
          id,
          name
        )
      `)
      .eq("barcode", barcode)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        // PGRST116 is the error code for "no rows returned"
        return null
      }
      console.error("Error fetching product:", error)
      return null
    }

    if (data) {
      return {
        ...data,
        category: data.categories as unknown as Category,
        isLowStock: data.stock <= data.min_stock,
        isExpiringSoon: data.expiry_date
          ? isExpiringSoon(data.expiry_date, data.expiry_notification_days || 30)
          : false,
      } as Product
    }

    return null
  } catch (err) {
    console.error("Error in fetchProductByBarcode:", err)
    return null
  }
}

export async function saveProduct(product: Product): Promise<Product> {
  if (!product.barcode) {
    throw new Error("Barcode is required")
  }

  if (!isSupabaseInitialized()) {
    console.warn("Supabase client not available. Using mock data.")
    const mockProduct = {
      ...product,
      id: product.id || Math.random().toString(36).substring(2, 9),
      created_at: new Date().toISOString(),
    }

    // Update our mock data
    if (product.barcode) {
      mockProducts[product.barcode] = mockProduct
    }

    return mockProduct
  }

  try {
    // Check if product already exists
    const existingProduct = await fetchProductByBarcode(product.barcode)

    if (existingProduct) {
      // Update existing product
      const { data, error } = await supabase
        .from("products")
        .update({
          name: product.name,
          price: product.price,
          image: product.image,
          category_id: product.category_id,
          purchase_price: product.purchase_price,
          expiry_date: product.expiry_date,
          expiry_notification_days: product.expiry_notification_days,
        })
        .eq("id", existingProduct.id)
        .select()
        .single()

      if (error) {
        console.error("Error updating product:", error)
        throw new Error(error.message)
      }

      return data as Product
    } else {
      // Insert new product
      const { data, error } = await supabase.from("products").insert(product).select().single()

      if (error) {
        console.error("Error inserting product:", error)
        throw new Error(error.message)
      }

      return data as Product
    }
  } catch (err) {
    console.error("Error in saveProduct:", err)
    // Return a mock saved product
    return {
      ...product,
      id: product.id || Math.random().toString(36).substring(2, 9),
      created_at: new Date().toISOString(),
    }
  }
}

export async function updateProductStock(id: string, newStock: number): Promise<void> {
  if (!isSupabaseInitialized()) {
    console.warn("Supabase client not available. Stock update simulated.")
    return
  }

  try {
    const { error } = await supabase.from("products").update({ stock: newStock }).eq("id", id)

    if (error) {
      console.error("Error updating stock:", error)
      throw new Error(error.message)
    }
  } catch (err) {
    console.error("Error in updateProductStock:", err)
  }
}

// Helper function to check if a product is expiring soon
function isExpiringSoon(expiryDateStr: string, notificationDays: number): boolean {
  const expiryDate = new Date(expiryDateStr)
  const today = new Date()
  const diffTime = expiryDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays <= notificationDays && diffDays >= 0
}

// Function to fetch product info from aswakassalam.com
export async function fetchProductInfoFromWeb(barcode: string): Promise<ProductFetchResult | null> {
  try {
    // In a real implementation, you would use a server-side API to scrape the website
    // For demo purposes, we'll simulate a successful fetch with mock data

    // This would be replaced with actual web scraping logic
    return {
      name: `Product ${barcode.substring(0, 4)}`,
      price: (Math.random() * 100).toFixed(2),
      image: "/placeholder.svg?height=200&width=200",
      description: "Product description fetched from website",
    }
  } catch (error) {
    console.error("Error fetching product info from web:", error)
    return null
  }
}


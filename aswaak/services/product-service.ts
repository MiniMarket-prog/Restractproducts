import { supabase } from "@/lib/supabase"
import type { Product, Category, ProductFetchResult } from "@/types/product"

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("*").order("name")

  if (error) {
    console.error("Error fetching categories:", error)
    throw new Error(error.message)
  }

  return data || []
}

export async function fetchProductByBarcode(barcode: string): Promise<Product | null> {
  if (!barcode) {
    throw new Error("Barcode is required")
  }

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
    throw new Error(error.message)
  }

  if (data) {
    return {
      ...data,
      category: data.categories as unknown as Category,
      isLowStock: data.stock <= data.min_stock,
      isExpiringSoon: data.expiry_date ? isExpiringSoon(data.expiry_date, data.expiry_notification_days || 30) : false,
    } as Product
  }

  return null
}

export async function saveProduct(product: Product): Promise<Product> {
  // Check if product already exists
  if (!product.barcode) {
    throw new Error("Barcode is required")
  }

  // Now we know product.barcode is not null or undefined
  const barcode: string = product.barcode
  const existingProduct = await fetchProductByBarcode(barcode)

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
}

export async function updateProductStock(id: string, newStock: number): Promise<void> {
  const { error } = await supabase.from("products").update({ stock: newStock }).eq("id", id)

  if (error) {
    console.error("Error updating stock:", error)
    throw new Error(error.message)
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

    // Real implementation would look something like:
    /*
    const response = await fetch(`/api/fetch-product?barcode=${barcode}`);
    if (!response.ok) {
      throw new Error('Failed to fetch product info');
    }
    return await response.json();
    */
  } catch (error) {
    console.error("Error fetching product info from web:", error)
    return null
  }
}


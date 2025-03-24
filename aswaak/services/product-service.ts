import { supabase, isSupabaseInitialized } from "@/lib/supabase"
import type { Product, Category, ProductFetchResult } from "@/types/product"

// Renamed function to avoid naming conflicts
function checkIfExpiringSoon(expiryDate: string, notificationDays: number): boolean {
  if (!expiryDate) return false

  const today = new Date()
  const expiry = new Date(expiryDate)
  const diffTime = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays <= notificationDays && diffDays >= 0
}

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

// Further improved fetchProductByBarcode function with better timeout handling
export async function fetchProductByBarcode(barcode: string): Promise<Product | null> {
  if (!barcode) return null

  if (!isSupabaseInitialized()) {
    console.warn("Supabase client not available. Using mock data.")
    return mockProducts[barcode] || null
  }

  // Create an AbortController for timeout
  const controller = new AbortController()
  let timeoutId: NodeJS.Timeout | null = null

  try {
    console.log(`Fetching product with barcode: ${barcode}`)

    // Set timeout to abort the request after 25 seconds
    timeoutId = setTimeout(() => {
      console.log(`Fetch timeout after 25s, aborting request for barcode ${barcode}`)
      controller.abort("Timeout exceeded")
    }, 25000) // Increased from 10000 to 25000 (25 seconds)

    try {
      // First, get the product - don't use the signal here as it causes issues with Supabase
      const { data: productData, error: productError } = await Promise.race([
        supabase.from("products").select("*").eq("barcode", barcode).single(),
        new Promise<never>((_, reject) => {
          // This promise will reject if the controller aborts
          controller.signal.addEventListener("abort", () => {
            reject(new Error(`Timeout fetching product with barcode ${barcode}`))
          })
        }),
      ])

      // Clear the timeout since we got a response
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      if (productError) {
        if (productError.code === "PGRST116") {
          // PGRST116 is the error code for "no rows returned"
          console.log(`No product found with barcode: ${barcode}`)
          return null
        }
        console.error("Error fetching product:", productError)
        return null
      }

      if (!productData) {
        console.log(`No product data returned for barcode: ${barcode}`)
        return null
      }

      // If we have a category_id, fetch the category separately
      let categoryData = null
      if (productData.category_id) {
        const { data: category, error: categoryError } = await supabase
          .from("categories")
          .select("*")
          .eq("id", productData.category_id)
          .single()

        if (!categoryError && category) {
          categoryData = category
        }
      }

      // Log the raw data to see what we're getting from Supabase
      console.log("Raw product data from Supabase:", JSON.stringify(productData, null, 2))

      // Create a properly structured product object
      const product = {
        ...productData,
        category: categoryData as Category | null,
        isLowStock:
          typeof productData.stock === "number" && typeof productData.min_stock === "number"
            ? productData.stock <= productData.min_stock
            : false,
        isExpiringSoon: productData.expiry_date
          ? checkIfExpiringSoon(
              productData.expiry_date as string,
              typeof productData.expiry_notification_days === "number" ? productData.expiry_notification_days : 30,
            )
          : false,
      } as Product

      // Log the processed product
      console.log("Processed product:", JSON.stringify(product, null, 2))

      return product
    } catch (fetchError) {
      // Clear the timeout in case of error
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      // Check if it's an abort error
      if (fetchError instanceof Error && (fetchError.name === "AbortError" || fetchError.message.includes("Timeout"))) {
        console.error(`Fetch timeout for barcode ${barcode}`)
        // Return null instead of throwing to prevent the app from getting stuck
        return null
      }

      console.error("Error in fetchProductByBarcode inner try/catch:", fetchError)
      // Return null instead of re-throwing to prevent the app from getting stuck
      return null
    }
  } catch (err) {
    // Clear the timeout in case of error in the outer try/catch
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    console.error("Error in fetchProductByBarcode:", err)
    // Return null instead of throwing to prevent the app from getting stuck
    return null
  }
}

// Add a new utility function for fetching with retry capability
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 2,
  timeout = 10000,
): Promise<Response> {
  let retries = 0

  while (retries <= maxRetries) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const fetchOptions = {
        ...options,
        signal: controller.signal,
      }

      console.log(`Fetching ${url} with timeout ${timeout}ms, retries left: ${maxRetries - retries}`)
      const response = await fetch(url, fetchOptions)
      clearTimeout(timeoutId)

      return response
    } catch (error) {
      retries++

      // If it's an abort error (timeout) or we've used all retries, throw the error
      if ((error instanceof Error && error.name === "AbortError") || retries > maxRetries) {
        console.error(`Fetch failed after ${retries} attempts:`, error)
        throw error
      }

      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, retries), 5000)
      console.log(`Retry ${retries}/${maxRetries} after ${delay}ms`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  // This should never be reached due to the throw in the catch block
  throw new Error(`Failed after ${maxRetries} retries`)
}

// Completely new approach to saveProduct function
export async function saveProduct(product: Product): Promise<Product> {
  try {
    if (!isSupabaseInitialized()) {
      console.log("Supabase not initialized, returning mock data")
      return product
    }

    // Prepare the data for Supabase - only include fields that exist in the database schema
    // Explicitly list all fields from the database schema to avoid any issues
    const updateData = {
      name: product.name,
      price: product.price,
      barcode: product.barcode,
      stock: product.stock,
      min_stock: product.min_stock,
      image: product.image,
      category_id: product.category_id,
      purchase_price: product.purchase_price,
      expiry_date: product.expiry_date,
      expiry_notification_days: product.expiry_notification_days,
      updated_by: product.updated_by || "system",
      updated_at: new Date().toISOString(),
    }

    console.log("Saving product with strictly filtered data:", updateData)

    // Use the most basic update operation possible
    const { error: updateError } = await supabase.from("products").update(updateData).eq("id", product.id)

    if (updateError) {
      console.error("Error updating product with basic operation:", updateError)
      throw new Error(`Failed to update product: ${updateError.message}`)
    }

    console.log("Product updated successfully, now fetching the updated product")

    // Fetch the updated product with a basic select
    const { data, error: fetchError } = await supabase
      .from("products")
      .select(
        "id, name, price, barcode, stock, min_stock, image, category_id, created_at, purchase_price, expiry_date, expiry_notification_days, created_by, updated_by, updated_at",
      )
      .eq("id", product.id)
      .single()

    if (fetchError) {
      console.error("Error fetching updated product:", fetchError)
      throw new Error(`Failed to fetch updated product: ${fetchError.message}`)
    }

    if (!data) {
      throw new Error("No data returned after updating product")
    }

    console.log("Product fetched successfully:", data)

    // Fetch the category separately if needed
    let categoryData = null
    if (data.category_id) {
      const { data: categoryResult, error: categoryError } = await supabase
        .from("categories")
        .select("id, name")
        .eq("id", data.category_id)
        .single()

      if (!categoryError && categoryResult) {
        categoryData = categoryResult
      }
    }

    // Transform the data to match our Product interface
    const savedProduct = {
      ...data,
      category: categoryData,
      isLowStock:
        typeof data.stock === "number" && typeof data.min_stock === "number" ? data.stock <= data.min_stock : false,
      isExpiringSoon: data.expiry_date
        ? checkIfExpiringSoon(data.expiry_date, data.expiry_notification_days || 30)
        : false,
    } as Product

    return savedProduct
  } catch (error) {
    console.error("Error in saveProduct:", error)
    throw error
  }
}

export async function updateProductStock(id: string, newStock: number, userId?: string): Promise<void> {
  if (!isSupabaseInitialized()) {
    console.warn("Supabase client not available. Stock update simulated.")
    return
  }

  try {
    const { error } = await supabase
      .from("products")
      .update({
        stock: newStock,
        updated_by: userId || "anonymous",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      console.error("Error updating stock:", error)
      throw new Error(error.message)
    }
  } catch (err) {
    console.error("Error in updateProductStock:", err)
  }
}

// Function to fetch product info from aswakassalam.com
export async function fetchProductInfoFromWeb(barcode: string): Promise<ProductFetchResult | null> {
  try {
    // Call our API route to fetch product info
    const response = await fetch(`/api/fetch-product?barcode=${barcode}`)

    if (!response.ok) {
      const errorData = await response.json()
      console.error("Error from API:", errorData)

      // If it's a 404 (product not available), throw a specific error
      if (response.status === 404) {
        throw new Error("404: Product not available in Aswak Assalam")
      }

      return null
    }

    const data = await response.json()

    // Format the price to ensure it's displayed correctly
    const formattedPrice = data.price ? data.price.replace(",", ".") : "0.00" // Replace comma with dot for decimal

    return {
      name: data.name,
      price: formattedPrice,
      image: data.image,
      description: `Category: ${data.category || "Unknown"}, In Stock: ${data.isInStock ? "Yes" : "No"}`,
      category: data.category,
      isInStock: Boolean(data.isInStock), // Fix: Use Boolean constructor to ensure it's a boolean
    }
  } catch (error) {
    console.error("Error fetching product info from web:", error)
    throw error
  }
}

// Function to get all products
export async function getAllProducts(): Promise<Product[]> {
  if (!isSupabaseInitialized()) {
    console.warn("Supabase client not available. Using mock data.")
    return Object.values(mockProducts)
  }

  try {
    // Fixed: Don't try to join with categories directly
    const { data, error } = await supabase.from("products").select("*").order("name")

    if (error) {
      console.error("Error fetching products:", error)
      return []
    }

    // Fetch all categories to use for mapping
    const { data: categoriesData, error: categoriesError } = await supabase.from("categories").select("*")

    if (categoriesError) {
      console.error("Error fetching categories:", categoriesError)
    }

    // Create a map of category IDs to category objects for quick lookup
    const categoriesMap = new Map<string, Category>()
    if (categoriesData) {
      categoriesData.forEach((category: Category) => {
        if (category.id) {
          categoriesMap.set(category.id, category)
        }
      })
    }

    // Process the products to add computed properties
    return data.map((product: any) => {
      const stock = typeof product.stock === "number" ? product.stock : 0
      const min_stock = typeof product.min_stock === "number" ? product.min_stock : 0
      const expiry_date = product.expiry_date ? String(product.expiry_date) : null
      const expiry_notification_days =
        typeof product.expiry_notification_days === "number" ? product.expiry_notification_days : 30

      // Look up the category from our map
      const category = product.category_id ? categoriesMap.get(product.category_id) || null : null

      return {
        ...product,
        category,
        isLowStock: stock <= min_stock,
        isExpiringSoon: expiry_date ? checkIfExpiringSoon(expiry_date, expiry_notification_days) : false,
      } as Product
    })
  } catch (error) {
    console.error("Error in getAllProducts:", error)
    return []
  }
}


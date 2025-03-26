import { createClient } from "@supabase/supabase-js"
import type { Product } from "@/types/product"

// Initialize Supabase client with better error handling
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check if the required environment variables are set
if (!supabaseUrl) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is not set")
}

if (!supabaseKey) {
  console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set")
}

// Create a function to get the Supabase client
// This allows us to handle the case where the environment variables are not set
const getSupabaseClient = () => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL and Key are required. Please check your environment variables.")
  }

  return createClient(supabaseUrl, supabaseKey)
}

/**
 * Fetch a product by its barcode
 */
export async function fetchProductByBarcode(barcode: string): Promise<Product | null> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.from("products").select("*").eq("barcode", barcode).single()

    if (error) {
      console.error("Error fetching product by barcode:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("Error in fetchProductByBarcode:", error)
    return null
  }
}

/**
 * Save a product to the database
 */
export async function saveProduct(product: Product): Promise<Product> {
  try {
    // Check if the product has a valid ID before updating
    if (!product.id) {
      throw new Error("Product ID is required for updating")
    }

    const supabase = getSupabaseClient()

    // Convert price and purchase_price to strings if they are numbers
    const priceAsString = typeof product.price === "number" ? product.price.toString() : product.price || ""

    const purchasePriceAsString =
      typeof product.purchase_price === "number" ? product.purchase_price.toString() : product.purchase_price || ""

    const { data, error } = await supabase
      .from("products")
      .update({
        name: product.name,
        barcode: product.barcode,
        description: product.description || null,
        price: priceAsString,
        purchase_price: purchasePriceAsString,
        stock: product.stock,
        min_stock: product.min_stock,
        image: product.image,
        category_id: product.category_id,
        quantity: product.quantity,
        expiry_notification_days: product.expiry_notification_days,
        data_source: product.data_source,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update product: ${error.message}`)
    }

    return data
  } catch (error) {
    console.error("Error in saveProduct:", error)
    throw error
  }
}

// Helper function to check if Supabase is initialized
const isSupabaseInitialized = () => {
  return supabaseUrl !== undefined && supabaseKey !== undefined
}

const checkIfExpiringSoon = (expiryDate: string, expiryNotificationDays: number): boolean => {
  const expiry = new Date(expiryDate)
  const now = new Date()
  const timeDiff = expiry.getTime() - now.getTime()
  const dayDiff = timeDiff / (1000 * 3600 * 24)

  return dayDiff <= expiryNotificationDays
}

const supabase = getSupabaseClient()

/**
 * Create a new product in the database
 */
export async function createProduct(product: Product): Promise<Product> {
  try {
    if (!isSupabaseInitialized()) {
      console.warn("Supabase client not available. Using mock data.")
      return { ...product, id: "mock-id-" + Date.now() }
    }

    console.log("Creating new product:", product)

    // Prepare the data for Supabase - only include fields that exist in the database schema
    const insertData = {
      name: product.name,
      barcode: product.barcode,
      description: product.description || null,
      price: typeof product.price === "number" ? product.price.toString() : product.price || "",
      stock: product.stock || 0,
      min_stock: product.min_stock || 0,
      image: product.image,
      category_id: product.category_id,
      purchase_price:
        typeof product.purchase_price === "number" ? product.purchase_price.toString() : product.purchase_price || "",
      expiry_date: product.expiry_date,
      expiry_notification_days: product.expiry_notification_days || 30,
      data_source: product.data_source,
      created_by: product.created_by || "system",
      updated_by: product.updated_by || "system",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    console.log("Inserting product with data:", insertData)

    // Insert the product
    const { data, error } = await supabase.from("products").insert(insertData).select().single()

    if (error) {
      console.error("Error creating product:", error)
      throw new Error(`Failed to create product: ${error.message}`)
    }

    if (!data) {
      throw new Error("No data returned after creating product")
    }

    console.log("Product created successfully:", data)

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
    const createdProduct = {
      ...data,
      category: categoryData,
      isLowStock:
        typeof data.stock === "number" && typeof data.min_stock === "number" ? data.stock <= data.min_stock : false,
      isExpiringSoon: data.expiry_date
        ? checkIfExpiringSoon(data.expiry_date, data.expiry_notification_days || 30)
        : false,
    } as Product

    return createdProduct
  } catch (error) {
    console.error("Error in createProduct:", error)
    throw error
  }
}

/**
 * Get products that are missing information (name, image, etc.)
 */
export async function getProductsMissingInfo(): Promise<Product[]> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .is("name", null)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching products missing info:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("Error in getProductsMissingInfo:", error)
    return []
  }
}

/**
 * Get all products
 */
export async function getAllProducts(): Promise<Product[]> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching all products:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("Error in getAllProducts:", error)
    return []
  }
}


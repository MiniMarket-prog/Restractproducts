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

export async function fetchProductByBarcode(barcode: string): Promise<Product | null> {
  if (!barcode) return null

  if (!isSupabaseInitialized()) {
    console.warn("Supabase client not available. Using mock data.")
    return mockProducts[barcode] || null
  }

  try {
    console.log(`Fetching product with barcode: ${barcode}`)

    // Use a more explicit query to ensure we get the category data
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
      // Log the raw data to see what we're getting from Supabase
      console.log("Raw product data from Supabase:", JSON.stringify(data, null, 2))

      // Create a properly structured product object
      const product: Product = {
        ...data,
        category: data.categories, // Assign the categories object directly
        isLowStock: data.stock <= data.min_stock,
        isExpiringSoon: data.expiry_date
          ? isExpiringSoon(data.expiry_date, data.expiry_notification_days || 30)
          : false,
      }

      // Log the processed product
      console.log("Processed product:", JSON.stringify(product, null, 2))

      return product
    }

    return null
  } catch (err) {
    console.error("Error in fetchProductByBarcode:", err)
    return null
  }
}

// Update the saveProduct function to handle local category IDs

export async function saveProduct(product: Product): Promise<Product> {
  if (!product.barcode) {
    throw new Error("Barcode is required")
  }

  // Check if we're using a local category ID (starts with "local-")
  if (product.category_id && product.category_id.startsWith("local-")) {
    console.log("Using local category ID, setting category_id to null for database storage")
    product.category_id = null // Set to null for database storage
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

    // Prepare the product data for insertion/update
    // Make sure to remove any properties that aren't in the database schema
    const productData = {
      name: product.name,
      price: product.price,
      barcode: product.barcode,
      stock: product.stock || 0,
      min_stock: product.min_stock || 0,
      image: product.image,
      category_id: product.category_id || null,
      purchase_price: product.purchase_price || null,
      expiry_date: product.expiry_date || null,
      expiry_notification_days: product.expiry_notification_days || 30,
    }

    // Log the product data being saved
    console.log("Saving product with data:", productData)

    if (existingProduct) {
      // Update existing product
      console.log("Updating existing product:", existingProduct.id)
      const { data, error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", existingProduct.id)
        .select()
        .single()

      if (error) {
        console.error("Error updating product:", error)
        throw new Error(error.message)
      }

      console.log("Product updated successfully:", data)

      // Fetch the category to include in the returned product
      let category = null
      if (data.category_id) {
        const { data: categoryData, error: categoryError } = await supabase
          .from("categories")
          .select("*")
          .eq("id", data.category_id)
          .single()

        if (categoryError) {
          console.error("Error fetching category:", categoryError)
        } else if (categoryData) {
          category = categoryData
        }
      }

      return {
        ...data,
        category: category,
        isLowStock: data.stock <= data.min_stock,
        isExpiringSoon: data.expiry_date
          ? isExpiringSoon(data.expiry_date, data.expiry_notification_days || 30)
          : false,
      } as Product
    } else {
      // Insert new product
      console.log("Inserting new product")

      // Remove any empty id field to let Supabase generate it
      if (product.id === "" || !product.id) {
        delete product.id
      }

      const { data, error } = await supabase.from("products").insert(productData).select().single()

      if (error) {
        console.error("Error inserting product:", error)
        throw new Error(error.message)
      }

      console.log("Product inserted successfully:", data)

      // Fetch the category to include in the returned product
      let category = null
      if (data.category_id) {
        const { data: categoryData, error: categoryError } = await supabase
          .from("categories")
          .select("*")
          .eq("id", data.category_id)
          .single()

        if (categoryError) {
          console.error("Error fetching category:", categoryError)
        } else if (categoryData) {
          category = categoryData
        }
      }

      return {
        ...data,
        category: category,
        isLowStock: data.stock <= data.min_stock,
        isExpiringSoon: data.expiry_date
          ? isExpiringSoon(data.expiry_date, data.expiry_notification_days || 30)
          : false,
      } as Product
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
    const formattedPrice = data.price.replace(",", ".") // Replace comma with dot for decimal

    return {
      name: data.name,
      price: formattedPrice,
      image: data.image,
      description: `Category: ${data.category || "Unknown"}, In Stock: ${data.isInStock ? "Yes" : "No"}`,
      category: data.category,
    }
  } catch (error) {
    console.error("Error fetching product info from web:", error)
    throw error
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


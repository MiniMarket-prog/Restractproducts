import { supabase, isSupabaseInitialized } from "@/lib/supabase"
import type { Category } from "@/types/product"

// Mock data for when Supabase is not available
const mockCategories: Category[] = [
  { id: "1", name: "Beverages" },
  { id: "2", name: "Dairy" },
  { id: "3", name: "Snacks" },
  { id: "4", name: "Groceries" },
]

// Add this function to check if categories exist in the database
export async function checkCategoriesExist(): Promise<boolean> {
  if (!isSupabaseInitialized()) {
    console.warn("Supabase client not available. Using mock data for category check.")
    return true // Pretend categories exist in mock mode
  }

  try {
    console.log("Checking if categories exist in the database...")
    const { count, error } = await supabase.from("categories").select("*", { count: "exact", head: true })

    if (error) {
      console.error("Error checking categories:", error)
      return false
    }

    console.log(`Found ${count} categories in the database`)
    return count !== null && count > 0
  } catch (err) {
    console.error("Error in checkCategoriesExist:", err)
    return false
  }
}

// Add this function to create default categories if none exist
export async function createDefaultCategoryIfNeeded(): Promise<void> {
  if (!isSupabaseInitialized()) {
    console.warn("Supabase client not available. Cannot create default categories.")
    return
  }

  try {
    // Check if categories exist
    const categoriesExist = await checkCategoriesExist()

    if (!categoriesExist) {
      console.log("No categories found, creating default categories...")

      // Create default categories
      const defaultCategories = [
        { name: "Beverages" },
        { name: "Dairy" },
        { name: "Snacks" },
        { name: "Groceries" },
        { name: "Household" },
        { name: "Personal Care" },
        { name: "Other" },
      ]

      try {
        const { data, error } = await supabase.from("categories").insert(defaultCategories).select()

        if (error) {
          console.error("Error creating default categories:", error)
        } else {
          console.log("Default categories created successfully:", data)
        }
      } catch (insertError) {
        console.error("Exception when creating categories:", insertError)
      }
    }
  } catch (err) {
    console.error("Error in createDefaultCategoryIfNeeded:", err)
  }
}

// Function to fetch all categories
export async function fetchCategories(): Promise<Category[]> {
  if (!isSupabaseInitialized()) {
    console.warn("Supabase client not available. Using mock data for categories.")
    return mockCategories
  }

  try {
    console.log("Fetching categories from Supabase...")

    // Add a delay to ensure the connection is established
    await new Promise((resolve) => setTimeout(resolve, 500))

    const { data, error } = await supabase.from("categories").select("*").order("name").not("name", "is", null) // Skip entries with null names

    if (error) {
      console.error("Error fetching categories:", error)
      return mockCategories
    }

    // Filter out any categories with empty names
    const validCategories = data?.filter((cat: Category) => cat.name && cat.name.trim() !== "") || []

    console.log("Categories fetched successfully:", validCategories)
    return validCategories
  } catch (err) {
    console.error("Error in fetchCategories:", err)
    return mockCategories
  }
}

// Function to get a category by ID
export async function getCategoryById(id: string): Promise<Category | null> {
  if (!isSupabaseInitialized() || !id) {
    return null
  }

  try {
    const { data, error } = await supabase.from("categories").select("*").eq("id", id).single()

    if (error) {
      console.error("Error fetching category by ID:", error)
      return null
    }

    return data
  } catch (err) {
    console.error("Error in getCategoryById:", err)
    return null
  }
}

// Function to create a new category
export async function createCategory(name: string): Promise<Category | null> {
  if (!isSupabaseInitialized() || !name || name.trim() === "") {
    return null
  }

  try {
    const { data, error } = await supabase.from("categories").insert({ name: name.trim() }).select().single()

    if (error) {
      console.error("Error creating category:", error)
      return null
    }

    console.log("Category created successfully:", data)
    return data
  } catch (err) {
    console.error("Error in createCategory:", err)
    return null
  }
}

// Function to update a category
export async function updateCategory(id: string, name: string): Promise<Category | null> {
  if (!isSupabaseInitialized() || !id || !name || name.trim() === "") {
    return null
  }

  try {
    const { data, error } = await supabase
      .from("categories")
      .update({ name: name.trim() })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating category:", error)
      return null
    }

    console.log("Category updated successfully:", data)
    return data
  } catch (err) {
    console.error("Error in updateCategory:", err)
    return null
  }
}

// Function to delete a category
export async function deleteCategory(id: string): Promise<boolean> {
  if (!isSupabaseInitialized() || !id) {
    return false
  }

  try {
    // First check if any products are using this category
    const { count, error: countError } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("category_id", id)

    if (countError) {
      console.error("Error checking products with category:", countError)
      return false
    }

    // If products are using this category, don't delete it
    if (count && count > 0) {
      console.error(`Cannot delete category: ${count} products are using it`)
      return false
    }

    // If no products are using it, proceed with deletion
    const { error } = await supabase.from("categories").delete().eq("id", id)

    if (error) {
      console.error("Error deleting category:", error)
      return false
    }

    console.log("Category deleted successfully")
    return true
  } catch (err) {
    console.error("Error in deleteCategory:", err)
    return false
  }
}

// Function to check if a category is in use by any products
export async function isCategoryInUse(id: string): Promise<boolean> {
  if (!isSupabaseInitialized() || !id) {
    return false
  }

  try {
    const { count, error } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("category_id", id)

    if (error) {
      console.error("Error checking if category is in use:", error)
      return false
    }

    return count !== null && count > 0
  } catch (err) {
    console.error("Error in isCategoryInUse:", err)
    return false
  }
}


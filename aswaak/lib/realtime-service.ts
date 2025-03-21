"use client"

import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import type { Product, Category } from "@/types/product"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

type RealtimeCallback<T> = (payload: { new: T; old: T | null }) => void

export const subscribeToProducts = (callback: RealtimeCallback<Product>) => {
  try {
    const subscription = supabase
      .channel("products-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log("Product change received:", payload)

          // Format the payload to match our Product type
          const newProduct = payload.new as Product
          const oldProduct = payload.old as Product | null

          // Call the callback with the formatted data
          callback({ new: newProduct, old: oldProduct })

          // Show a toast notification for the change
          const { toast } = useToast()
          if (payload.eventType === "INSERT") {
            toast({
              title: "New Product Added",
              description: `${newProduct.name} has been added to the database.`,
            })
          } else if (payload.eventType === "UPDATE") {
            toast({
              title: "Product Updated",
              description: `${newProduct.name} has been updated.`,
            })
          } else if (payload.eventType === "DELETE") {
            toast({
              title: "Product Deleted",
              description: `A product has been removed from the database.`,
            })
          }
        },
      )
      .subscribe()

    // Return an unsubscribe function
    return () => {
      supabase.removeChannel(subscription)
    }
  } catch (error) {
    console.error("Error subscribing to products:", error)
    // Return a no-op function in case of error
    return () => {}
  }
}

export const subscribeToCategories = (callback: RealtimeCallback<Category>) => {
  try {
    const subscription = supabase
      .channel("categories-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "categories",
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log("Category change received:", payload)

          // Format the payload to match our Category type
          const newCategory = payload.new as Category
          const oldCategory = payload.old as Category | null

          // Call the callback with the formatted data
          callback({ new: newCategory, old: oldCategory })

          // Show a toast notification for the change
          const { toast } = useToast()
          if (payload.eventType === "INSERT") {
            toast({
              title: "New Category Added",
              description: `${newCategory.name} has been added to the categories.`,
            })
          } else if (payload.eventType === "UPDATE") {
            toast({
              title: "Category Updated",
              description: `${newCategory.name} has been updated.`,
            })
          } else if (payload.eventType === "DELETE") {
            toast({
              title: "Category Deleted",
              description: `A category has been removed.`,
            })
          }
        },
      )
      .subscribe()

    // Return an unsubscribe function
    return () => {
      supabase.removeChannel(subscription)
    }
  } catch (error) {
    console.error("Error subscribing to categories:", error)
    // Return a no-op function in case of error
    return () => {}
  }
}


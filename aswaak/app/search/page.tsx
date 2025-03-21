"use client"

import { useState } from "react"
import { ProductSearch } from "@/components/product-search"
import { ProductDisplay } from "@/components/product-display"
import { ProductForm } from "@/components/product-form"
import { saveProduct } from "@/services/product-service"
import { fetchCategories } from "@/services/category-service"
import { useToast } from "@/hooks/use-toast"
import type { Product } from "@/types/product"
import { useEffect } from "react"

export default function SearchPage() {
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const { toast } = useToast()

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await fetchCategories()
        setCategories(categoriesData)
      } catch (err) {
        console.error("Error loading categories:", err)
      }
    }

    loadCategories()
  }, [])

  const handleProductSelect = (product: Product) => {
    setCurrentProduct(product)
    setShowForm(false)
  }

  const handleFormSuccess = async (product: Product) => {
    try {
      setIsLoading(true)
      const savedProduct = await saveProduct(product)

      toast({
        title: "Product Saved",
        description: "Product has been successfully saved to the database.",
      })

      setCurrentProduct(savedProduct)
      setShowForm(false)

      // Update history
      const history = JSON.parse(localStorage.getItem("scanHistory") || "[]")
      const historyEntry = {
        ...savedProduct,
        created_at: savedProduct.created_at || new Date().toISOString(),
      }

      const existingIndex = history.findIndex(
        (item: Product) =>
          (item.barcode && item.barcode === savedProduct.barcode) || (item.id && item.id === savedProduct.id),
      )

      let updatedHistory = [...history]
      if (existingIndex >= 0) {
        updatedHistory[existingIndex] = historyEntry
      } else {
        updatedHistory = [historyEntry, ...history]
      }

      updatedHistory = updatedHistory.slice(0, 50)
      localStorage.setItem("scanHistory", JSON.stringify(updatedHistory))
    } catch (error) {
      toast({
        title: "Error Saving Product",
        description: `Failed to save product: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4">Search Products</h1>

        <ProductSearch onProductSelect={handleProductSelect} isLoading={isLoading} />

        {currentProduct && !showForm && <ProductDisplay product={currentProduct} onEdit={() => setShowForm(true)} />}

        {showForm && currentProduct && (
          <ProductForm
            initialData={currentProduct}
            categories={categories}
            onCancel={() => setShowForm(false)}
            onSuccess={handleFormSuccess}
            isLoading={isLoading}
          />
        )}
      </div>
    </main>
  )
}


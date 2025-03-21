"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Product } from "@/types/product"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/supabase"

interface ProductSearchProps {
  onProductSelect: (product: Product) => void
  isLoading?: boolean
}

// Define a type for the database row
type ProductRow = Database["public"]["Tables"]["products"]["Row"] & {
  categories: {
    id: string
    name: string
  } | null
}

export function ProductSearch({ onProductSelect, isLoading = false }: ProductSearchProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const { toast } = useToast()

  const resetSearch = () => {
    setSearchQuery("")
    setSearchResults([])
    setIsSearching(false)
  }

  useEffect(() => {
    // Reset search when component unmounts
    return () => {
      resetSearch()
    }
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!searchQuery.trim()) {
      toast({
        title: "Search query required",
        description: "Please enter a product name or barcode to search",
        variant: "destructive",
      })
      return
    }

    setIsSearching(true)
    setSearchResults([])

    try {
      // Search by name (case insensitive, partial match)
      const { data: nameResults, error: nameError } = await supabase
        .from("products")
        .select(`
          *,
          categories:category_id (
            id,
            name
          )
        `)
        .ilike("name", `%${searchQuery}%`)
        .order("name")
        .limit(10)

      // Search by barcode (exact match)
      const { data: barcodeResults, error: barcodeError } = await supabase
        .from("products")
        .select(`
          *,
          categories:category_id (
            id,
            name
          )
        `)
        .eq("barcode", searchQuery)
        .limit(1)

      if (nameError || barcodeError) {
        throw new Error(nameError?.message || barcodeError?.message)
      }

      // Combine results, prioritizing barcode matches
      let combinedResults: Product[] = []

      if (barcodeResults && barcodeResults.length > 0) {
        // Process barcode results
        combinedResults = barcodeResults.map((item: ProductRow) => ({
          ...item,
          category: item.categories as unknown as { id: string; name: string },
          isLowStock: item.stock <= item.min_stock,
        }))
      }

      if (nameResults && nameResults.length > 0) {
        // Process name results and add them if they're not already in the results
        const nameItems = nameResults.map((item: ProductRow) => {
          console.log("Processing search result item:", item)

          // Create a properly structured product object
          const product: Product = {
            ...item,
            category: item.categories, // Assign the categories object directly
            isLowStock: item.stock <= item.min_stock,
          }

          return product
        })

        // Filter out duplicates (in case a product matched both queries)
        nameItems.forEach((item: Product) => {
          if (!combinedResults.some((r) => r.id === item.id)) {
            combinedResults.push(item)
          }
        })
      }

      setSearchResults(combinedResults)

      if (combinedResults.length === 0) {
        toast({
          title: "No products found",
          description: `No products match "${searchQuery}"`,
        })
      }
    } catch (error) {
      console.error("Search error:", error)
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "An error occurred during search",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleProductClick = (product: Product) => {
    onProductSelect(product)
    // Reset the search state after selection
    setSearchResults([])
    setSearchQuery("")
    setIsSearching(false)
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <Input
            placeholder="Search by name or barcode"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isLoading || isSearching}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || isSearching}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-2 mt-2">
            <p className="text-sm text-muted-foreground">Search results:</p>
            {searchResults.map((product) => (
              <div
                key={product.id}
                className="p-2 border rounded-md cursor-pointer hover:bg-accent"
                onClick={() => handleProductClick(product)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.barcode ? `Barcode: ${product.barcode}` : "No barcode"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{product.price} DH</p>
                    <p className="text-sm">Stock: {product.stock}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}


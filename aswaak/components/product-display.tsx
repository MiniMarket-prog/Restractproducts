"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit } from "lucide-react"
import type { Product } from "@/types/product"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useSettings } from "@/contexts/settings-context"

interface ProductDisplayProps {
  product: Product
  onEdit: () => void
}

export function ProductDisplay({ product, onEdit }: ProductDisplayProps) {
  const { settings } = useSettings()

  // Log the product to see what we're working with
  console.log("Product in ProductDisplay:", JSON.stringify(product, null, 2))

  // Updated formatDate to handle null values
  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString()
  }

  // Create a default image path
  const defaultImage = "/placeholder.svg?height=200&width=200"

  // Always show images regardless of settings
  const showImages = true // Override settings to always show images

  // Update the getValidImageSrc function to better handle image URLs
  const getValidImageSrc = (): string => {
    console.log("Getting image source from:", product.image)

    // If product.image exists and is a string
    if (product.image && typeof product.image === "string") {
      console.log("Product has image:", product.image)

      // If it's a valid URL (starts with http or https), use it as is
      if (product.image.startsWith("http://") || product.image.startsWith("https://")) {
        console.log("Using full URL image:", product.image)
        return product.image
      }
      // If it's a relative path but not the placeholder, use it
      else if (!product.image.includes("/placeholder.svg")) {
        console.log("Using relative path image:", product.image)
        return product.image
      }
    }

    // Otherwise use the default image
    console.log("Using default image")
    return defaultImage
  }

  // Get category name with better handling of different formats
  const getCategoryName = (): string | null => {
    console.log("Getting category name from:", product.category, product.categories, product.category_id)

    // If no category data at all
    if (!product.category && !product.categories && !product.category_id) {
      console.log("No category data found")
      return null
    }

    // If category is a string
    if (typeof product.category === "string") {
      console.log("Category is a string:", product.category)
      return product.category
    }

    // If category is an object with name property
    if (product.category && typeof product.category === "object") {
      console.log("Category is an object:", product.category)
      if ("name" in product.category && product.category.name) {
        return product.category.name
      }
    }

    // If categories is an object with name property (from Supabase join)
    if (product.categories && typeof product.categories === "object") {
      console.log("Categories is an object:", product.categories)
      if ("name" in product.categories && product.categories.name) {
        return product.categories.name
      }
    }

    console.log("No category name found in any property")
    return null
  }

  // Format the product name to include quantity if available
  const displayName = product.quantity ? `${product.name} ${product.quantity}` : product.name

  // Get category name
  const categoryName = getCategoryName()
  console.log("Resolved category name:", categoryName)

  return (
    <Card className="mb-4 overflow-hidden">
      {/* Always show the image section */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 flex justify-center">
        <img
          src={getValidImageSrc() || "/placeholder.svg"}
          alt={product.name}
          className="object-contain h-48 w-auto max-w-full"
          onError={(e) => {
            console.error("Image failed to load:", (e.target as HTMLImageElement).src)
            ;(e.target as HTMLImageElement).src = defaultImage
          }}
        />
      </div>

      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            {categoryName && (
              <Badge variant="outline" className="mb-2">
                {categoryName}
              </Badge>
            )}
            <CardTitle className="text-xl">{displayName}</CardTitle>
          </div>
          <div className="text-2xl font-bold text-primary">{product.price} DH</div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Barcode</p>
            <p className="font-medium">{product.barcode || "N/A"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Stock</p>
            <div className="flex items-center gap-2">
              <p className="font-medium">{product.stock}</p>
              {product.isLowStock && (
                <Badge variant="destructive" className="text-xs">
                  Low
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Separator />
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button className="flex-1" onClick={onEdit}>
          <Edit className="mr-2 h-4 w-4" />
          Edit Product
        </Button>
      </CardFooter>
    </Card>
  )
}

